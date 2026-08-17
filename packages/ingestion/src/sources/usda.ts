/**
 * USDA FSIS recall feed.
 *
 * USDA publishes recalls as RSS. Less structured than CPSC/FDA; we extract
 * brand, product, and a date, but lot ranges typically appear in the
 * full description text.
 */
import { XMLParser } from "fast-xml-parser";
import type { IngestedRecall } from "../types.js";

const RSS_URL = "https://www.fsis.usda.gov/recalls-alerts/recalls/rss";

export async function fetchUSDA(args: {
  maxItems?: number;
}): Promise<IngestedRecall[]> {
  const res = await fetch(RSS_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`USDA RSS returned ${res.status}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const json = parser.parse(xml);
  const items = extractItems(json);

  return items.slice(0, args.maxItems ?? 100).flatMap(normalizeUSDA).filter(Boolean) as IngestedRecall[];
}

function extractItems(json: unknown): Array<Record<string, unknown>> {
  if (typeof json !== "object" || json === null) return [];
  const root = (json as Record<string, unknown>).rss as
    | Record<string, unknown>
    | undefined;
  if (!root) return [];
  const channel = root.channel as Record<string, unknown> | undefined;
  if (!channel) return [];
  const raw = channel.item;
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [raw as Record<string, unknown>];
}

function normalizeUSDA(item: Record<string, unknown>): IngestedRecall | null {
  const title = pickString(item.title);
  const link = pickString(item.link);
  const description = pickString(item.description);
  const pubDate = pickString(item.pubDate);
  const guid = pickString(item.guid);

  if (!title || !link) return null;

  // USDA titles usually follow: "Company Name Recalls Product Name for Contamination"
  const { brand, productName } = parseUSDATitle(title);

  const fullText = `${title}\n\n${description ?? ""}`;
  const criteria = [];
  if (brand) {
    criteria.push({
      field: "brand" as const,
      operator: "eq" as const,
      value: brand,
      rawText: brand,
    });
  }

  return {
    source: "usda",
    sourceId: guid ?? link,
    title,
    description: fullText,
    brand,
    productName,
    sourceUrl: link,
    publishedAt: parseDate(pubDate) ?? new Date(),
    rawPayload: item,
    criteria,
  };
}

function parseUSDATitle(title: string): { brand?: string; productName?: string } {
  // Common patterns:
  //   "Acme Foods Recalls X for Y"
  //   "Acme Recalls Ready-to-Eat X"
  const m = title.match(/^([A-Z][\w'&\- .]+?)\s+(?:Recalls|Recall)\s+(.+?)(?:\s+for\b|\s+due\b|$)/i);
  if (m) {
    return { brand: m[1]?.trim(), productName: m[2]?.trim() };
  }
  return {};
}

function pickString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in v) {
    const t = (v as Record<string, unknown>)["#text"];
    if (typeof t === "string") return t;
  }
  return undefined;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}