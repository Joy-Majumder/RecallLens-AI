/**
 * Core types for the RecallLens matcher.
 *
 * The matcher is intentionally deterministic — Gemini reads the photo,
 * these types carry the structured result, and the rule-based engine
 * decides what (if anything) matches a recall.
 */

export type PhotoType =
  | "full_product"
  | "front_only"
  | "back_only"
  | "unclear";

export interface ProductIdentifiers {
  brand?: string;
  productName?: string;
  variant?: string;
  category?: string;
  lotCode?: string;
  mfgDate?: string; // ISO YYYY-MM-DD
  expiryDate?: string; // ISO YYYY-MM-DD
}

export interface MatchInput {
  product: ProductIdentifiers;
  photoType: PhotoType;
  productConfidence: number; // 0..1 — how sure we are about which product this is
  lotConfidence: number; // 0..1 — how sure we are about the lot code read
}

export type CriterionField =
  | "brand"
  | "product_name"
  | "lot_code"
  | "serial"
  | "mfg_date";

export type CriterionOperator = "eq" | "prefix" | "contains" | "range" | "regex";

export interface RecallCriterion {
  field: CriterionField;
  operator: CriterionOperator;
  value: unknown;
  rawText?: string;
}

export type RecallSource = "cpsc" | "fda" | "usda" | "nhtsa" | "manual";

export interface Recall {
  id: string;
  source: RecallSource;
  title: string;
  sourceUrl: string;
  brand?: string;
  productName?: string;
  criteria: RecallCriterion[];
}

export type Outcome =
  | "potential_match"
  | "no_match"
  | "more_info_needed"
  | "unable_to_verify";

export interface RuleResult {
  /** Rule identifier (e.g. "brand", "lotCode", "dateRange") */
  rule: string;
  /** Whether the criterion passed */
  passed: boolean;
  /** Whether this criterion could be evaluated given the available data */
  evaluated: boolean;
  /** Human-readable reason — goes into the explanation */
  reason: string;
  /** 0..1 contribution to overall confidence (only meaningful if evaluated) */
  score: number;
  /** Field the rule operates on */
  field: CriterionField;
}

export interface MatchResult {
  outcome: Outcome;
  confidence: number; // 0..1
  rules: RuleResult[];
  missingFields: string[];
  message: string;
  /** Recall id this result is for */
  recallId: string;
}