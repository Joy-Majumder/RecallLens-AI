import type { RuleResult } from "../types.js";
import { normalizeString, similarity } from "../normalize.js";

/**
 * Product name matching rule.
 *
 * Product names are messier than brands — they include model numbers,
 * sizes, packaging variants. We support:
 *  - exact match (best)
 *  - one contains the other (e.g. "Acme Infant Formula 32oz" vs "Acme Infant Formula")
 *  - fuzzy similarity >= 0.8 as a fallback
 */
export function matchProductName(
  productName: string | undefined,
  criterionValue: unknown,
  rawText?: string
): RuleResult {
  const field = "product_name" as const;

  if (!productName || !productName.trim()) {
    return {
      rule: "productName",
      field,
      passed: false,
      evaluated: false,
      reason: "Product name could not be read from the photo.",
      score: 0,
    };
  }

  const target = String(criterionValue ?? "").trim();
  if (!target) {
    return {
      rule: "productName",
      field,
      passed: false,
      evaluated: false,
      reason: "Recall does not specify a product name.",
      score: 0,
    };
  }

  const np = normalizeString(productName);
  const nt = normalizeString(target);

  if (np === nt) {
    return {
      rule: "productName",
      field,
      passed: true,
      evaluated: true,
      reason: `Product name matches "${target}".`,
      score: 1,
    };
  }

  if (np.includes(nt) || nt.includes(np)) {
    return {
      rule: "productName",
      field,
      passed: true,
      evaluated: true,
      reason: `Product name contains/contained-in "${target}".`,
      score: 0.9,
    };
  }

  const sim = similarity(productName, target);
  if (sim >= 0.8) {
    return {
      rule: "productName",
      field,
      passed: true,
      evaluated: true,
      reason: `Product name closely matches "${target}" (similarity ${(sim * 100).toFixed(0)}%).`,
      score: sim,
    };
  }

  return {
    rule: "productName",
    field,
    passed: false,
    evaluated: true,
    reason: `Product name "${productName}" does not match "${target}".`,
    score: sim,
  };
}