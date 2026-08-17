import type {
  CriterionField,
  MatchInput,
  MatchResult,
  Outcome,
  Recall,
  RecallCriterion,
  RuleResult,
} from "./types.js";
import { PHOTO_TYPE_BEHAVIOR } from "./photoType.js";
import { determineOutcome } from "./outcomes.js";
import {
  matchBrand,
  matchLotCode,
  matchMfgDate,
  matchProductName,
  matchSerial,
} from "./rules/index.js";

/**
 * Confidence thresholds. Both scores must clear their respective threshold
 * before a match/no-match verdict is emitted; otherwise we ask for more info.
 */
const PRODUCT_CONFIDENCE_THRESHOLD = 0.7;
const LOT_CONFIDENCE_THRESHOLD = 0.7;

// Weights for blending per-rule scores with the two input confidence scores.
// Rule scores dominate (0.6) because they directly reflect criterion coverage.
const CONFIDENCE_BLEND = {
  rule: 0.6,
  product: 0.25,
  lot: 0.15,
} as const;

const IDENTITY_FIELDS = new Set<CriterionField>(["brand", "product_name"]);
const SPECIFIC_ID_FIELDS = new Set<CriterionField>(["lot_code", "serial", "mfg_date"]);

/**
 * Severity rank for an outcome. Used by the consumer app to pick the
 * "most important" match result to show first (e.g. on the result page
 * or the history list).
 */
export function outcomeRank(outcome: Outcome): number {
  switch (outcome) {
    case "potential_match": return 4;
    case "more_info_needed": return 3;
    case "unable_to_verify": return 2;
    case "no_match": return 1;
  }
}

export function evaluate(input: MatchInput, recall: Recall): MatchResult {
  const rules: RuleResult[] = [];
  const missingFields = gatherMissingFields(input, recall);

  const behavior = PHOTO_TYPE_BEHAVIOR[input.photoType];
  const effectiveProductConf = Math.max(behavior.productFloor, input.productConfidence);
  const effectiveLotConf = Math.max(behavior.lotFloor, input.lotConfidence);

  for (const criterion of recall.criteria) {
    rules.push(evaluateCriterion(criterion, input));
  }

  // Multiple criteria on the same field are OR'd, not AND'd. A recall
  // listing "lots 4167, 4169" means "this lot OR this lot" — if any one
  // matches, the field is satisfied. Without this, the conjunction in
  // outcomes.ts would force `unable_to_verify` whenever one alternative
  // fails even though another passed.
  const fieldLevelRules = collapseByField(rules);
  const evaluated = fieldLevelRules.filter((r) => r.evaluated);
  const identityPassed = identityPassedFor(fieldLevelRules);

  const hasAnyCriteria = recall.criteria.length > 0;
  const hasEvaluatedCriteria = evaluated.length > 0;
  const specificEvaluated = rules.filter(
    (r) => r.evaluated && SPECIFIC_ID_FIELDS.has(r.field)
  );
  const allSpecificCriteriaFailed =
    specificEvaluated.length > 0 && specificEvaluated.every((r) => !r.passed);

  const { outcome, message } = determineOutcome({
    rules: fieldLevelRules,
    missingFields,
    hasEvaluatedCriteria,
    hasAnyCriteria,
    hasSpecificIdCriterion: specificEvaluated.length > 0,
    allSpecificCriteriaFailed,
    identityPassed,
  });

  const confidence = computeConfidence(
    outcome,
    effectiveProductConf,
    effectiveLotConf,
    evaluated
  );

  return {
    outcome,
    confidence,
    rules: fieldLevelRules,
    missingFields: dedupe(missingFields),
    message,
    recallId: recall.id,
  };
}

/**
 * Collapse multiple per-criterion rules on the same field into one field-level
 * rule. Pass/fail is OR across the alternatives: a recall listing lots
 * "4167 OR 4169" passes when the product matches at least one.
 *
 * `evaluated` follows the same rule — a field counts as evaluated if any
 * of its alternatives was evaluated. `score` is the best score across
 * alternatives; `reason` is the passing alternative's reason (or the
 * first one if none passed).
 */
function collapseByField(rules: RuleResult[]): RuleResult[] {
  const byField = new Map<string, RuleResult[]>();
  for (const r of rules) {
    const list = byField.get(r.field) ?? [];
    list.push(r);
    byField.set(r.field, list);
  }
  const out: RuleResult[] = [];
  for (const [field, group] of byField) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const evaluated = group.some((r) => r.evaluated);
    const passing = group.find((r) => r.passed);
    const representative = passing ?? group[0];
    const bestScore = group.reduce((best, r) => Math.max(best, r.score), 0);
    out.push({
      rule: representative.rule,
      field: representative.field,
      evaluated,
      passed: !!passing,
      score: bestScore,
      reason: passing
        ? passing.reason
        : group
            .filter((r) => r.evaluated)
            .map((r) => r.reason)
            .join(" | ") || representative.reason,
    });
    // Preserve field name on the synthesized row.
    out[out.length - 1].field = field as CriterionField;
  }
  return out;
}

function gatherMissingFields(input: MatchInput, recall: Recall): string[] {
  const missing: string[] = [];
  const behavior = PHOTO_TYPE_BEHAVIOR[input.photoType];
  const effectiveProductConf = Math.max(behavior.productFloor, input.productConfidence);
  const effectiveLotConf = Math.max(behavior.lotFloor, input.lotConfidence);

  if (effectiveProductConf < PRODUCT_CONFIDENCE_THRESHOLD) {
    missing.push("product_identity");
  }

  const recallNeedsLotOrSerial = recall.criteria.some(
    (c) => c.field === "lot_code" || c.field === "serial"
  );
  const recallNeedsMfgDate = recall.criteria.some((c) => c.field === "mfg_date");
  const recallNeedsAnySpecificId =
    recallNeedsLotOrSerial || recallNeedsMfgDate;

  if (
    recallNeedsAnySpecificId &&
    effectiveLotConf < LOT_CONFIDENCE_THRESHOLD
  ) {
    missing.push("lot_code");
  }
  if (
    behavior.requireLotForConfidentNoMatch &&
    !input.product.lotCode &&
    recallNeedsAnySpecificId
  ) {
    missing.push("lot_code");
  }
  if (recallNeedsLotOrSerial && !input.product.lotCode?.trim()) {
    missing.push("lot_code");
  }
  if (recallNeedsMfgDate && !input.product.mfgDate?.trim()) {
    missing.push("mfg_date");
  }

  return missing;
}

function identityPassedFor(rules: RuleResult[]): boolean {
  const identityRules = rules.filter(
    (r) => r.evaluated && IDENTITY_FIELDS.has(r.field)
  );
  if (identityRules.length === 0) return true; // no identity criteria → trivially passes
  return identityRules.every((r) => r.passed);
}

function evaluateCriterion(
  criterion: RecallCriterion,
  input: MatchInput
): RuleResult {
  switch (criterion.field) {
    case "brand":
      return matchBrand(input.product.brand, criterion.value, criterion.rawText);
    case "product_name":
      return matchProductName(input.product.productName, criterion.value, criterion.rawText);
    case "lot_code":
      return matchLotCode(input.product.lotCode, criterion.operator, criterion.value, criterion.rawText);
    case "serial":
      // serials share the same input slot as lot codes
      return matchSerial(input.product.lotCode, criterion.operator, criterion.value, criterion.rawText);
    case "mfg_date":
      return matchMfgDate(input.product.mfgDate, criterion.operator, criterion.value, criterion.rawText);
  }
}

function computeConfidence(
  outcome: Outcome,
  productConf: number,
  lotConf: number,
  evaluated: RuleResult[]
): number {
  if (outcome === "more_info_needed" || outcome === "unable_to_verify") {
    return round3(productConf);
  }

  const ruleScores = evaluated.map((r) => r.score);
  const avgRuleScore =
    ruleScores.length === 0
      ? 1
      : ruleScores.reduce((s, n) => s + n, 0) / ruleScores.length;

  const blended =
    avgRuleScore * CONFIDENCE_BLEND.rule +
    productConf * CONFIDENCE_BLEND.product +
    lotConf * CONFIDENCE_BLEND.lot;

  return round3(Math.max(0, Math.min(1, blended)));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}