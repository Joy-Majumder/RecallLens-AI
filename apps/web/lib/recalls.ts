/**
 * Local recall corpus. In production this is replaced by the ingestion
 * package syncing against CPSC/FDA/USDA/NHTSA feeds.
 */
import recallsData from "../../../data/recalls.json";
import type { Recall } from "@recalllens/matcher";
import { normalizeString } from "@recalllens/matcher";

interface IndexedRecall extends Recall {
  _brandKey: string;
  _productKey: string;
}

const SEED_RECALLS: IndexedRecall[] = (recallsData as Recall[]).map((r) => ({
  ...r,
  _brandKey: normalizeString(r.brand ?? ""),
  _productKey: normalizeString(r.productName ?? ""),
}));

const BY_BRAND = new Map<string, Recall[]>();
const BY_PRODUCT = new Map<string, Recall[]>();

for (const r of SEED_RECALLS) {
  if (r._brandKey) {
    const list = BY_BRAND.get(r._brandKey) ?? [];
    list.push(r);
    BY_BRAND.set(r._brandKey, list);
  }
  if (r._productKey) {
    const list = BY_PRODUCT.get(r._productKey) ?? [];
    list.push(r);
    BY_PRODUCT.set(r._productKey, list);
  }
}

export function getAllRecalls(): Recall[] {
  return SEED_RECALLS;
}

function tokensMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function findCandidateRecalls(input: {
  brand?: string;
  productName?: string;
}): Recall[] {
  const brandKey = normalizeString(input.brand ?? "");
  const productKey = normalizeString(input.productName ?? "");
  if (!brandKey && !productKey) return [];

  const matched = new Set<Recall>();
  for (const [key, recalls] of BY_BRAND) {
    if (tokensMatch(key, brandKey)) recalls.forEach((r) => matched.add(r));
  }
  for (const [key, recalls] of BY_PRODUCT) {
    if (tokensMatch(key, productKey)) recalls.forEach((r) => matched.add(r));
  }
  return Array.from(matched);
}

export function getRecallById(id: string): Recall | undefined {
  return SEED_RECALLS.find((r) => r.id === id);
}