import type { RuleResult } from "../types.js";
import { normalizeCode } from "../normalize.js";
import { matchLotCode } from "./lotCode.js";

/**
 * Serial range rule — covers vehicle VINs, electronics serials, etc.
 * Reuses the lot-code matcher since the operator semantics are identical
 * (eq / prefix / contains / range / regex).
 *
 * The "field" stays "serial" so audit trails distinguish it from lot codes.
 */
export function matchSerial(
  productSerial: string | undefined,
  operator: "eq" | "prefix" | "contains" | "range" | "regex",
  value: unknown,
  rawText?: string
): RuleResult {
  if (!productSerial || !productSerial.trim()) {
    return {
      rule: "serial",
      field: "serial",
      passed: false,
      evaluated: false,
      reason: "Serial number could not be read from the product photo.",
      score: 0,
    };
  }

  const result = matchLotCode(productSerial, operator, value, rawText);
  // Re-label for the audit trail
  return { ...result, rule: "serial", field: "serial" };
}