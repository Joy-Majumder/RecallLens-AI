import type { RuleResult } from "../types.js";
import { isRangeValue, pass, fail, unevaluated } from "./_helpers.js";

/**
 * Date range rule for manufacturing dates.
 *
 * Recalls frequently say "units manufactured between 2024-01-01 and
 * 2024-03-31". We compare the product's mfg_date to that range.
 *
 * Operator semantics:
 *   - "range" — value is {min, max} in YYYY-MM-DD
 *   - "eq"    — exact date match (rare but possible)
 *   - "regex" — for less structured text
 */

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function matchMfgDate(
  productMfgDate: string | undefined,
  operator: "eq" | "prefix" | "contains" | "range" | "regex",
  value: unknown,
  rawText?: string
): RuleResult {
  const field = "mfg_date" as const;

  if (!productMfgDate || !productMfgDate.trim()) {
    return unevaluated("mfgDate", field, "Manufacturing date could not be read from the product photo.");
  }

  if (!isValidISODate(productMfgDate)) {
    return unevaluated(
      "mfgDate",
      field,
      `Manufacturing date "${productMfgDate}" is not a valid ISO date.`
    );
  }

  switch (operator) {
    case "range": {
      if (!isRangeValue(value)) {
        return unevaluated("mfgDate", field, "Recall date range criterion is malformed.");
      }
      if (!isValidISODate(value.min) || !isValidISODate(value.max)) {
        return unevaluated("mfgDate", field, "Recall date range bounds are not valid ISO dates.");
      }
      const inRange =
        productMfgDate >= value.min && productMfgDate <= value.max;
      return inRange
        ? pass(
            "mfgDate",
            field,
            `Manufacturing date ${productMfgDate} falls within recalled window ${value.min}..${value.max}.`,
            1
          )
        : fail(
            "mfgDate",
            field,
            `Manufacturing date ${productMfgDate} falls outside recalled window ${value.min}..${value.max}.`,
            0
          );
    }

    case "eq": {
      const target = String(value ?? "");
      if (!isValidISODate(target)) {
        return unevaluated("mfgDate", field, "Recall date equality criterion is malformed.");
      }
      return productMfgDate === target
        ? pass("mfgDate", field, `Manufacturing date matches recalled date ${target}.`, 1)
        : fail("mfgDate", field, `Manufacturing date ${productMfgDate} does not match recalled date ${target}.`, 0);
    }

    case "regex": {
      const pattern = String(value ?? "");
      if (!pattern) return unevaluated("mfgDate", field, "Recall date regex has no pattern.");
      try {
        const re = new RegExp(pattern);
        return re.test(productMfgDate)
          ? pass("mfgDate", field, `Manufacturing date matches recall pattern.`, 1)
          : fail("mfgDate", field, `Manufacturing date does not match recall pattern.`, 0);
      } catch {
        return unevaluated("mfgDate", field, "Recall date regex is invalid.");
      }
    }

    default:
      return unevaluated("mfgDate", field, `Unsupported operator "${operator}" for date criterion.`);
  }
}