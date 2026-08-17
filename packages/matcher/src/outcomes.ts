import type { Outcome, RuleResult } from "./types.js";

/**
 * Map a set of rule results and pre-flight signals to one of the four
 * honest outcomes:
 *
 *   - potential_match:    identity matches AND the lot/serial/date is in
 *                         the recalled range, with sufficient confidence
 *   - no_match:           identity matches AND lot/serial/date is clearly
 *                         outside the recalled range
 *   - more_info_needed:   we don't have enough to decide
 *   - unable_to_verify:   the recall itself is structurally incomplete
 *
 * Order of checks matters: missing fields → unable_to_verify → match/no_match.
 */

export interface OutcomeContext {
  rules: RuleResult[];
  missingFields: string[];
  /** Recall has at least one evaluated criterion */
  hasEvaluatedCriteria: boolean;
  /** Recall has no criteria at all (e.g. brand-only fallback recall) */
  hasAnyCriteria: boolean;
  /** Lot/serial/date criterion exists in the recall */
  hasSpecificIdCriterion: boolean;
  /** All specific (lot/serial/date) criteria failed definitively */
  allSpecificCriteriaFailed: boolean;
  /** Brand/product identity criteria all passed */
  identityPassed: boolean;
}

export function determineOutcome(ctx: OutcomeContext): {
  outcome: Outcome;
  message: string;
} {
  // 1. Missing required fields → can't decide, ask user
  if (ctx.missingFields.length > 0) {
    return {
      outcome: "more_info_needed",
      message: `We need more information to make a determination: ${ctx.missingFields.join(", ")}.`,
    };
  }

  // 2. Recall has no criteria at all → structurally unverifiable
  if (!ctx.hasAnyCriteria) {
    return {
      outcome: "unable_to_verify",
      message: "This recall notice does not contain enough structured information to verify against.",
    };
  }

  // 3. Some criteria were malformed/unevaluable → can't fully verify
  if (ctx.hasAnyCriteria && !ctx.hasEvaluatedCriteria) {
    return {
      outcome: "unable_to_verify",
      message: "This recall's criteria could not be fully evaluated.",
    };
  }

  // 4. All criteria evaluated
  const evaluated = ctx.rules.filter((r) => r.evaluated);
  const allPassed = evaluated.every((r) => r.passed);

  if (allPassed) {
    return {
      outcome: "potential_match",
      message: "This product appears to match the recalled units based on the identifiers we checked.",
    };
  }

  // Identity matched but specific ID criterion failed → no match
  if (
    ctx.identityPassed &&
    ctx.hasSpecificIdCriterion &&
    ctx.allSpecificCriteriaFailed
  ) {
    return {
      outcome: "no_match",
      message: "This product is not among the units listed in the recall.",
    };
  }

  // Some criteria failed but not all specific ones — partial info
  return {
    outcome: "unable_to_verify",
    message:
      "Some criteria could not be definitively evaluated. Please review the details below.",
  };
}