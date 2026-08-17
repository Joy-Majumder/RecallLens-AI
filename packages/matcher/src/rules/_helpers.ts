/**
 * Shared rule helpers used by every rule file.
 */
import type { CriterionField, RuleResult } from "../types.js";

export function isRangeValue(v: unknown): v is { min: string; max: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).min === "string" &&
    typeof (v as Record<string, unknown>).max === "string"
  );
}

export function pass(
  rule: string,
  field: CriterionField,
  reason: string,
  score: number
): RuleResult {
  return { rule, field, passed: true, evaluated: true, reason, score };
}

export function fail(
  rule: string,
  field: CriterionField,
  reason: string,
  score: number
): RuleResult {
  return { rule, field, passed: false, evaluated: true, reason, score };
}

export function unevaluated(
  rule: string,
  field: CriterionField,
  reason: string
): RuleResult {
  return { rule, field, passed: false, evaluated: false, reason, score: 0 };
}