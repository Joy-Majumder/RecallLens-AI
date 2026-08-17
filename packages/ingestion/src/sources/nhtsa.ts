/**
 * NHTSA recall feed.
 *
 * Docs: https://www.nhtsa.gov/nhtsa-datasets-and-apis
 *
 * NHTSA campaigns have a campaign ID, manufacturer, make/model/year, and
 * a "Component" (the affected system). Lot ranges don't apply for vehicles;
 * criteria are usually a range of model years or specific VIN ranges.
 */
import type { IngestedRecall } from "../types.js";

const BASE_URL = "https://api.nhtsa.gov/recalls/recallsByVehicle";

export async function fetchNHTSA(args: {
  apiKey?: string;
  maxItems?: number;
}): Promise<IngestedRecall[]> {
  // NHTSA requires a vehicle query — we iterate a small set of common
  // makes/years. For full coverage, the production version would page
  // through their campaign data feed instead.
  const makes = ["Ford", "Toyota", "Honda", "Chevrolet", "Tesla", "BMW"];
  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const out: IngestedRecall[] = [];
  const seen = new Set<string>();

  for (const make of makes) {
    for (const year of years) {
      try {
        const url = `${BASE_URL}?make=${encodeURIComponent(make)}&model=&modelYear=${year}${
          args.apiKey ? `&api_key=${encodeURIComponent(args.apiKey)}` : ""
        }`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
        for (const r of json.results ?? []) {
          const normalized = normalizeNHTSA(r);
          if (normalized && !seen.has(normalized.sourceId)) {
            seen.add(normalized.sourceId);
            out.push(normalized);
          }
        }
      } catch (err) {
        // Continue past per-make/year errors
        console.warn(`[nhtsa] ${make} ${year}:`, err);
      }
    }
  }

  return out.slice(0, args.maxItems ?? 500);
}

function normalizeNHTSA(item: Record<string, unknown>): IngestedRecall | null {
  const nhtsaId = (item.NHTSACampaignNumber ?? item.nhtsaCampaignNumber) as
    | string
    | undefined;
  if (!nhtsaId) return null;

  const manufacturer = pickStr(item.Manufacturer ?? item.manufacturer);
  const model = pickStr(item.Model ?? item.model);
  const year = pickStr(item.ModelYear ?? item.modelYear);
  const component = pickStr(item.Component ?? item.component);
  const summary = pickStr(item.Summary ?? item.summary);
  const remedy = pickStr(item.Remedy ?? item.remedy);
  const consequence = pickStr(item.Consequence ?? item.consequence);
  const reportDate = pickStr(
    item.ReportReceivedDate ?? item.reportReceivedDate ?? item["Report Received Date"]
  );

  const criteria = [];
  if (manufacturer) {
    criteria.push({
      field: "brand" as const,
      operator: "eq" as const,
      value: manufacturer,
      rawText: manufacturer,
    });
  }
  if (year) {
    criteria.push({
      field: "lot_code" as const, // we use lot_code slot for "model year" for vehicles
      operator: "eq" as const,
      value: year,
      rawText: `Model year ${year}`,
    });
  }

  return {
    source: "nhtsa",
    sourceId: nhtsaId,
    title: `${manufacturer ?? "Vehicle"} ${year ?? ""} ${model ?? ""}: ${component ?? "Recall"}`.trim(),
    description: [summary, consequence, remedy].filter(Boolean).join("\n\n"),
    brand: manufacturer,
    productName: `${year ?? ""} ${model ?? ""}`.trim(),
    category: component ?? "vehicle",
    sourceUrl: `https://www.nhtsa.gov/recalls?nhtsaId=${nhtsaId}`,
    publishedAt: parseDate(reportDate) ?? new Date(),
    rawPayload: item,
    criteria,
  };
}

function pickStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // NHTSA dates are often like "04/15/2024" or "APR 15, 2024"
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}