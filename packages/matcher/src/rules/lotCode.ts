import type { RuleResult } from "../types.js";
import { normalizeCode } from "../normalize.js";
import { isRangeValue, pass, fail, unevaluated } from "./_helpers.js";

/**
 * Lot code matching rule.
 *
 * Supports four operators:
 *   - "eq"      — exact code match
 *   - "prefix"  — recall covers all codes starting with this prefix
 *   - "contains" — recall covers codes containing this substring
 *   - "range"   — value is {min, max}; codes are compared as strings
 *                 (lexicographic for alphanumeric ranges — most recalls
 *                  use monotonically incrementing lot codes)
 *
 * Numeric extraction: many lot codes embed a serial number ("A100", "A299").
 * When the operator is "range", we try to extract the numeric portion and
 * compare numerically first, falling back to string compare.
 */

function inRange(code: string, min: string, max: string): boolean {
  const codeNum = trailingNumber(code);
  const minNum = trailingNumber(min);
  const maxNum = trailingNumber(max);

  if (codeNum !== null && minNum !== null && maxNum !== null) {
    return codeNum >= minNum && codeNum <= maxNum;
  }
  return code >= min && code <= max;
}

function trailingNumber(s: string): number | null {
  const m = s.match(/(\d+)\s*$/);
  if (!m || !m[1]) return null;
  return parseInt(m[1], 10);
}

export function matchLotCode(
  productLot: string | undefined,
  operator: "eq" | "prefix" | "contains" | "range" | "regex",
  value: unknown,
  rawText?: string
): RuleResult {
  const field = "lot_code" as const;

  if (!productLot || !productLot.trim()) {
    return unevaluated("lotCode", field, "Lot code could not be read from the product photo.");
  }

  const code = normalizeCode(productLot);

  switch (operator) {
    case "eq": {
      const target = normalizeCode(String(value ?? ""));
      if (!target) {
        return unevaluated("lotCode", field, "Recall lot criterion has no value.");
      }
      return code === target
        ? pass("lotCode", field, `Lot code "${code}" matches recalled code.`, 1)
        : fail("lotCode", field, `Lot code "${code}" is not the recalled code "${target}".`, 0);
    }

    case "prefix": {
      const target = normalizeCode(String(value ?? ""));
      if (!target) {
        return unevaluated("lotCode", field, "Recall lot prefix criterion has no value.");
      }
      return code.startsWith(target)
        ? pass("lotCode", field, `Lot code "${code}" starts with recalled prefix "${target}".`, 1)
        : fail("lotCode", field, `Lot code "${code}" does not start with recalled prefix "${target}".`, 0);
    }

    case "contains": {
      const target = normalizeCode(String(value ?? ""));
      if (!target) {
        return unevaluated("lotCode", field, "Recall lot contains criterion has no value.");
      }
      return code.includes(target)
        ? pass("lotCode", field, `Lot code "${code}" contains recalled substring "${target}".`, 1)
        : fail("lotCode", field, `Lot code "${code}" does not contain recalled substring "${target}".`, 0);
    }

    case "range": {
      if (!isRangeValue(value)) {
        return unevaluated("lotCode", field, "Recall lot range criterion is malformed.");
      }
      const min = normalizeCode(value.min);
      const max = normalizeCode(value.max);
      return inRange(code, min, max)
        ? pass("lotCode", field, `Lot code "${code}" falls within recalled range ${min}..${max}.`, 1)
        : fail("lotCode", field, `Lot code "${code}" falls outside recalled range ${min}..${max}.`, 0);
    }

    case "regex": {
      const pattern = String(value ?? "");
      if (!pattern) return unevaluated("lotCode", field, "Recall lot regex criterion has no pattern.");
      try {
        const re = new RegExp(pattern, "i");
        return re.test(code)
          ? pass("lotCode", field, `Lot code "${code}" matches recall pattern.`, 1)
          : fail("lotCode", field, `Lot code "${code}" does not match recall pattern.`, 0);
      } catch {
        return unevaluated("lotCode", field, "Recall lot regex is invalid.");
      }
    }
  }
}