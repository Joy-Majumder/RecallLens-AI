/**
 * CPSC (Consumer Product Safety Commission) SaferProducts API.
 *
 * Docs: https://www.saferproducts.gov/RestWebApi/
 *
 * CPSC publishes structured recall data including model numbers, lot
 * ranges (when available), and manufacturing date windows.
 */
import type { IngestedRecall, IngestedCriterion } from "../types.js";

const BASE_URL = "https://www.saferproducts.gov/RestWebApi";

interface CPSCRecall {
  RecallID: string;
  Title: string;
  Description?: string;
  ProductType?: string;
  Manufacturer?: string;
  RecallDate?: string; // YYYY-MM-DD
  RecallURL?: string;
  // CPSC includes structured model/lot info under "Products"
  Products?: Array<{
    Name?: string;
    Model?: string;
    Description?: string;
    LotNumbers?: string;
    ManufacturingDates?: string;
    Number?: number;
  }>;
}

export async function fetchCPSC(args: {
  apiKey?: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<IngestedRecall[]> {
  const pageSize = args.pageSize ?? 50;
  const maxPages = args.maxPages ?? 10;
  const out: IngestedRecall[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE_URL}/Recalls?format=json&Page=${page}&PageSize=${pageSize}${
      args.apiKey ? `&apikey=${encodeURIComponent(args.apiKey)}` : ""
    }`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`CPSC API error ${res.status} on page ${page}`);
    }
    const json = (await res.json()) as unknown;
    const recalls = parseCPSCResponse(json);
    if (recalls.length === 0) break;
    out.push(...recalls);
    if (recalls.length < pageSize) break;
  }

  return out;
}

function parseCPSCResponse(json: unknown): IngestedRecall[] {
  // CPSC returns { results: CPSCRecall[] } or a bare array depending on endpoint version
  const arr: unknown[] = Array.isArray(json)
    ? json
    : isObject(json) && Array.isArray((json as Record<string, unknown>).results)
      ? ((json as Record<string, unknown>).results as unknown[])
      : [];

  const out: IngestedRecall[] = [];
  for (const item of arr) {
    const r = normalizeCPSC(item);
    if (r) out.push(r);
  }
  return out;
}

function normalizeCPSC(item: unknown): IngestedRecall | null {
  if (!isObject(item)) return null;
  const r = item as Partial<CPSCRecall>;
  if (!r.RecallID || !r.Title) return null;

  const criteria: IngestedCriterion[] = (r.Products ?? []).flatMap((p) => {
    const out: IngestedCriterion[] = [];
    if (p.LotNumbers) {
      // CPSC often lists lot ranges as plain text like "A100-A199" or
      // "ABC-12345 through ABC-12399". We keep it as raw_text; the
      // matcher will parse at evaluation time.
      out.push({
        field: "lot_code" as const,
        operator: "contains" as const,
        value: p.LotNumbers,
        rawText: p.LotNumbers,
      });
    }
    if (p.ManufacturingDates) {
      out.push({
        field: "mfg_date" as const,
        operator: "contains" as const,
        value: p.ManufacturingDates,
        rawText: p.ManufacturingDates,
      });
    }
    return out;
  });

  if (r.Manufacturer) {
    criteria.unshift({
      field: "brand" as const,
      operator: "eq" as const,
      value: r.Manufacturer,
      rawText: r.Manufacturer,
    });
  }

  return {
    source: "cpsc",
    sourceId: r.RecallID,
    title: r.Title,
    description: r.Description ?? r.Title,
    brand: r.Manufacturer,
    productName: r.Products?.[0]?.Name,
    category: r.ProductType,
    sourceUrl:
      r.RecallURL ?? `https://www.saferproducts.gov/Recalls/Detail/${r.RecallID}`,
    publishedAt: parseDate(r.RecallDate) ?? new Date(),
    rawPayload: item,
    criteria,
  };
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}