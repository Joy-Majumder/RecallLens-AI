/**
 * Sync orchestrator: pull from each source, upsert into Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestedRecall, SyncResult } from "./types.js";
import { fetchCPSC } from "./sources/cpsc.js";
import { fetchFDA } from "./sources/fda.js";
import { fetchUSDA } from "./sources/usda.js";
import { fetchNHTSA } from "./sources/nhtsa.js";

export async function syncSource(
  client: SupabaseClient,
  source: IngestedRecall["source"],
  recalls: IngestedRecall[]
): Promise<SyncResult> {
  const start = Date.now();
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const recall of recalls) {
    try {
      const { data: existing, error: selErr } = await client
        .from("recalls")
        .select("id")
        .eq("source", recall.source)
        .eq("source_id", recall.sourceId)
        .maybeSingle();

      if (selErr) {
        errors++;
        console.error(`[${source}] select error:`, selErr.message);
        continue;
      }

      const payload = {
        source: recall.source,
        source_id: recall.sourceId,
        title: recall.title,
        description: recall.description,
        brand: recall.brand ?? null,
        product_name: recall.productName ?? null,
        category: recall.category ?? null,
        source_url: recall.sourceUrl,
        published_at: recall.publishedAt.toISOString(),
        raw_payload: recall.rawPayload as Record<string, unknown>,
      };

      let recallId: string | null = existing?.id ?? null;

      if (recallId) {
        const { error: upErr } = await client
          .from("recalls")
          .update(payload)
          .eq("id", recallId);
        if (upErr) {
          errors++;
          console.error(`[${source}] update error:`, upErr.message);
          continue;
        }
        // Replace criteria (idempotent — small N)
        await client.from("recall_criteria").delete().eq("recall_id", recallId);
        updated++;
      } else {
        const { data: insertedRow, error: insErr } = await client
          .from("recalls")
          .insert(payload)
          .select("id")
          .single();
        if (insErr || !insertedRow) {
          errors++;
          console.error(`[${source}] insert error:`, insErr?.message);
          continue;
        }
        recallId = insertedRow.id;
        inserted++;
      }

      if (recall.criteria.length > 0 && recallId) {
        const criteriaRows = recall.criteria.map((c) => ({
          recall_id: recallId,
          field: c.field,
          operator: c.operator,
          value: c.value as Record<string, unknown>,
          raw_text: c.rawText ?? null,
        }));
        const { error: critErr } = await client
          .from("recall_criteria")
          .insert(criteriaRows);
        if (critErr) {
          console.warn(`[${source}] criteria insert error:`, critErr.message);
        }
      }
    } catch (e) {
      errors++;
      console.error(`[${source}] unexpected error:`, e);
    }
  }

  return {
    source,
    fetched: recalls.length,
    inserted,
    updated,
    errors,
    durationMs: Date.now() - start,
  };
}

export async function runFullSync(client: SupabaseClient): Promise<SyncResult[]> {
  const results = await Promise.allSettled([
    fetchCPSC({ apiKey: process.env.CPSC_API_KEY, pageSize: 50, maxPages: 4 })
      .then((r) => syncSource(client, "cpsc", r)),
    fetchFDA({ apiKey: process.env.FDA_API_KEY, limit: 100 })
      .then((r) => syncSource(client, "fda", r)),
    fetchUSDA({ maxItems: 100 }).then((r) => syncSource(client, "usda", r)),
    fetchNHTSA({ maxItems: 200 }).then((r) => syncSource(client, "nhtsa", r)),
  ]);

  return results.map((r, i) => {
    const source = ["cpsc", "fda", "usda", "nhtsa"][i]!;
    if (r.status === "fulfilled") return r.value;
    return {
      source: source as IngestedRecall["source"],
      fetched: 0,
      inserted: 0,
      updated: 0,
      errors: 1,
      durationMs: 0,
    };
  });
}