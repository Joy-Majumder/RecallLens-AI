/**
 * Background match: for each newly synced recall, run the matcher
 * against every product that might match, and emit a notification for
 * each confirmed potential_match.
 *
 * Inputs are pulled from Supabase. The matcher itself is the same
 * deterministic engine used by the consumer app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluate, type MatchInput, type Recall } from "@recalllens/matcher";
import { sendEmail } from "./channels/email.js";

export interface NotificationJobResult {
  recallsProcessed: number;
  productsScanned: number;
  notificationsSent: number;
  durationMs: number;
}

interface ProductRow {
  id: string;
  user_id: string;
  brand: string | null;
  product_name: string | null;
  variant: string | null;
  category: string | null;
  lot_code: string | null;
  mfg_date: string | null;
  expiry_date: string | null;
  product_confidence: number | string;
  lot_confidence: number | string;
  photo_type: string;
  user_email?: string | null;
}

interface RecallRow {
  id: string;
  source: string;
  title: string;
  source_url: string;
  brand: string | null;
  product_name: string | null;
  recall_criteria?: Array<{
    field: string;
    operator: string;
    value: unknown;
    raw_text: string | null;
  }>;
}

export async function runNotificationJob(
  client: SupabaseClient,
  args?: { sinceIso?: string }
): Promise<NotificationJobResult> {
  const start = Date.now();
  const sinceIso =
    args?.sinceIso ??
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch recalls created since the last run
  const { data: recalls, error: recErr } = await client
    .from("recalls")
    .select(
      "id, source, title, source_url, brand, product_name, recall_criteria(field, operator, value, raw_text)"
    )
    .gte("created_at", sinceIso);

  if (recErr) throw new Error(`Failed to fetch recalls: ${recErr.message}`);
  const recallRows = (recalls ?? []) as RecallRow[];

  let productsScanned = 0;
  let notificationsSent = 0;

  // 2. For each recall, find candidate products (brand/product/category match)
  for (const recallRow of recallRows) {
    const recall = await rowToRecall(client, recallRow);
    if (!recall) continue;

    const candidates = await findCandidateProducts(client, recallRow);
    productsScanned += candidates.length;

    for (const product of candidates) {
      const match = evaluate(toMatchInput(product), recall);
      if (match.outcome !== "potential_match") continue;

      // Persist match for audit
      await persistMatch(client, product, recall, match);

      // Notify, de-duped
      const sent = await maybeNotify(client, recall, match, product);
      if (sent) notificationsSent++;
    }
  }

  return {
    recallsProcessed: recallRows.length,
    productsScanned,
    notificationsSent,
    durationMs: Date.now() - start,
  };
}

async function rowToRecall(
  client: SupabaseClient,
  row: RecallRow
): Promise<Recall | null> {
  // Fetch criteria separately (the join above is typed loosely)
  const { data: criteria } = await client
    .from("recall_criteria")
    .select("field, operator, value, raw_text")
    .eq("recall_id", row.id);

  return {
    id: row.id,
    source: row.source as Recall["source"],
    title: row.title,
    sourceUrl: row.source_url,
    brand: row.brand ?? undefined,
    productName: row.product_name ?? undefined,
    criteria: (criteria ?? []).map((c) => ({
      field: c.field as Recall["criteria"][number]["field"],
      operator: c.operator as Recall["criteria"][number]["operator"],
      value: c.value,
      rawText: c.raw_text ?? undefined,
    })),
  };
}

async function findCandidateProducts(
  client: SupabaseClient,
  recall: RecallRow
): Promise<ProductRow[]> {
  // Brand-or-category filter, then evaluate each against the matcher
  const filters: string[] = [];
  if (recall.brand) filters.push(`brand.eq.${recall.brand}`);
  if (recall.product_name) filters.push(`product_name.eq.${recall.product_name}`);
  if (filters.length === 0) {
    // Brand-level recall — match against all products would be too noisy.
    // These should still be discoverable via the manual recall flow.
    return [];
  }

  const { data: products } = await client
    .from("products")
    .select(
      "id, user_id, brand, product_name, variant, category, lot_code, mfg_date, expiry_date, product_confidence, lot_confidence, photo_type"
    )
    .or(filters.join(","));

  const rows = (products ?? []) as ProductRow[];

  // Resolve user emails in a single batch query rather than per-product.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  if (userIds.length > 0) {
    const { data: users } = await client.auth.admin.listUsers();
    const emailById = new Map<string, string>();
    for (const u of users?.users ?? []) {
      if (u.email) emailById.set(u.id, u.email);
    }
    for (const row of rows) {
      row.user_email = emailById.get(row.user_id);
    }
  }

  return rows;
}

function toMatchInput(product: ProductRow): MatchInput {
  return {
    product: {
      brand: product.brand ?? undefined,
      productName: product.product_name ?? undefined,
      variant: product.variant ?? undefined,
      category: product.category ?? undefined,
      lotCode: product.lot_code ?? undefined,
      mfgDate: product.mfg_date ?? undefined,
      expiryDate: product.expiry_date ?? undefined,
    },
    photoType: product.photo_type as MatchInput["photoType"],
    productConfidence: Number(product.product_confidence),
    lotConfidence: Number(product.lot_confidence),
  };
}

async function persistMatch(
  client: SupabaseClient,
  product: ProductRow,
  recall: Recall,
  match: ReturnType<typeof evaluate>
): Promise<void> {
  await client.from("matches").insert({
    product_id: product.id,
    recall_id: recall.id,
    outcome: match.outcome,
    confidence: match.confidence,
    explanation: match.rules,
    missing_fields: match.missingFields,
  });
}

async function maybeNotify(
  client: SupabaseClient,
  recall: Recall,
  match: ReturnType<typeof evaluate>,
  product: ProductRow
): Promise<boolean> {
  // De-dupe: skip if we already notified this product/recall/email combo
  const { data: existing } = await client
    .from("notifications")
    .select("id")
    .eq("product_id", product.id)
    .eq("recall_id", recall.id)
    .eq("channel", "email")
    .maybeSingle();

  if (existing) return false;

  if (product.user_email) {
    await sendEmail({
      to: product.user_email,
      subject: `Recall alert: ${product.brand ?? "product"} you scanned`,
      body: emailBody(recall, match, product),
    });
  }

  await client.from("notifications").insert({
    user_id: product.user_id,
    product_id: product.id,
    recall_id: recall.id,
    channel: "email",
  });

  return true;
}

function emailBody(
  recall: Recall,
  match: ReturnType<typeof evaluate>,
  product: ProductRow
): string {
  return `A product you scanned may match a recall.

Product: ${product.brand ?? ""} ${product.product_name ?? ""}
Lot code: ${product.lot_code ?? "(none on file)"}

Recall: ${recall.title}
Source: ${recall.source.toUpperCase()}
View the official notice: ${recall.sourceUrl}

This is a verification alert from RecallLens AI. RecallLens reads what is on your product and compares it against official recall data — it is a verification tool, not a certified safety authority. Always confirm with the source agency.

Why we matched: ${match.rules.filter((r) => r.passed).map((r) => r.reason).join(" | ")}`;
}