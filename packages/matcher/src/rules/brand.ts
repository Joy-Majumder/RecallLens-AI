import type { RuleResult } from "../types.js";
import { normalizeString, similarity } from "../normalize.js";

/**
 * Brand matching rule.
 *
 * Brand is typically one of the more reliable fields. We use exact match
 * (after normalization) as the gold standard, but allow fuzzy matching
 * when similarity is high (>= 0.85) so a slightly misread brand still works.
 */
export function matchBrand(
  productBrand: string | undefined,
  criterionValue: unknown,
  rawText?: string
): RuleResult {
  const field = "brand" as const;

  if (!productBrand || !productBrand.trim()) {
    return {
      rule: "brand",
      field,
      passed: false,
      evaluated: false,
      reason: "Brand could not be read from the product photo.",
      score: 0,
    };
  }

  const target = String(criterionValue ?? "").trim();
  if (!target) {
    return {
      rule: "brand",
      field,
      passed: false,
      evaluated: false,
      reason: "Recall does not specify a brand.",
      score: 0,
    };
  }

  const np = normalizeString(productBrand);
  const nt = normalizeString(target);

  if (np === nt) {
    return {
      rule: "brand",
      field,
      passed: true,
      evaluated: true,
      reason: `Brand "${productBrand}" matches recall target "${target}".`,
      score: 1,
    };
  }

  // Fuzzy fallback — handle minor OCR errors
  const sim = similarity(productBrand, target);
  if (sim >= 0.85) {
    return {
      rule: "brand",
      field,
      passed: true,
      evaluated: true,
      reason: `Brand "${productBrand}" closely matches recall target "${target}" (similarity ${(sim * 100).toFixed(0)}%).`,
      score: sim,
    };
  }

  return {
    rule: "brand",
    field,
    passed: false,
    evaluated: true,
    reason: `Brand "${productBrand}" does not match recall target "${target}".`,
    score: sim,
  };
}