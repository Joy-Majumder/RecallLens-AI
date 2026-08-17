/**
 * FDA openFDA recall endpoints.
 *
 * Docs: https://open.fda.gov/apis/
 *
 * We pull from two endpoints:
 *  - device/recall (medical devices)
 *  - food/enforcement (food, cosmetics)
 *
 * FDA's enforcement reports include distribution patterns and reason for
 * recall but rarely structured lot ranges. We capture the brand/product
 * fields plus the raw text for downstream pattern extraction.
 */
import type { IngestedRecall } from "../types.js";

const BASE_URL = "https://api.fda.gov";

interface FDAResult {
  results: Array<Record<string, unknown>>;
}

export async function fetchFDA(args: {
  apiKey?: string;
  endpoint?: "device" | "food" | "drug" | "all";
  limit?: number;
}): Promise<IngestedRecall[]> {
  const endpoint = args.endpoint ?? "all";
  const limit = args.limit ?? 100;
  const keyParam = args.apiKey ? `&api_key=${encodeURIComponent(args.apiKey)}` : "";

  const endpoints =
    endpoint === "all"
      ? ["device/recall", "food/enforcement", "drug/enforcement"]
      : [endpointPath(endpoint)];

  const out: IngestedRecall[] = [];
  for (const path of endpoints) {
    const url = `${BASE_URL}/${path}.json?limit=${limit}&sort=recall_initiation_date:desc${keyParam}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        // FDA endpoints may not exist for every combination — log and skip
        console.warn(`[fda] ${path} returned ${res.status}, skipping`);
        continue;
      }
      const json = (await res.json()) as FDAResult;
      for (const r of json.results ?? []) {
        const n = normalizeFDA(r, path);
        if (n) out.push(n);
      }
    } catch (err) {
      console.warn(`[fda] ${path} fetch failed:`, err);
    }
  }
  return out;
}

function endpointPath(e: "device" | "food" | "drug"): string {
  if (e === "device") return "device/recall";
  if (e === "food") return "food/enforcement";
  return "drug/enforcement";
}

function normalizeFDA(
  item: Record<string, unknown>,
  path: string
): IngestedRecall | null {
  // Field names differ between device/recall and food/enforcement.
  // Device recall has: cfres_id, product_description, recalling_firm, recall_initiation_date
  // Food enforcement has: recall_number, product_description, recalling_firm, recall_initiation_date
  const id = (item.cfres_id ?? item.recall_number ?? item.event_id) as
    | string
    | undefined;
  const description = (item.product_description ?? item.product_type) as
    | string
    | undefined;
  const firm = (item.recalling_firm ?? item.recall_firm) as string | undefined;
  const date = (item.recall_initiation_date ?? item.event_date) as
    | string
    | undefined;
  const classification = item.classification as string | undefined;
  const reason = (item.reason_for_recall ?? item.reason) as string | undefined;
  const distribution = (item.distribution_pattern ?? item.code_info) as
    | string
    | undefined;

  if (!id || !description) return null;

  const criteria = [];
  if (firm) {
    criteria.push({
      field: "brand" as const,
      operator: "eq" as const,
      value: firm,
      rawText: firm,
    });
  }
  // code_info often contains lot ranges — keep as raw text
  if (distribution && typeof distribution === "string") {
    criteria.push({
      field: "lot_code" as const,
      operator: "contains" as const,
      value: distribution,
      rawText: distribution,
    });
  }

  return {
    source: "fda",
    sourceId: `${path}:${id}`,
    title: `FDA recall: ${firm ?? "Unknown firm"} — ${truncate(description, 80)}`,
    description:
      [description, reason && `Reason: ${reason}`, classification && `Class: ${classification}`]
        .filter(Boolean)
        .join("\n\n"),
    brand: firm,
    productName: typeof description === "string" ? description.slice(0, 200) : undefined,
    sourceUrl: `https://www.accessdata.fda.gov/scripts/ires/index.cfm?Event=${encodeURIComponent(id)}`,
    publishedAt: parseDate(date) ?? new Date(),
    rawPayload: item,
    criteria,
  };
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // FDA uses YYYYMMDD or YYYY-MM-DD
  const iso = /^\d{8}$/.test(s)
    ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}