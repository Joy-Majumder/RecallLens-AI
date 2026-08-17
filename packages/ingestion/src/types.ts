import type { CriterionField, CriterionOperator } from "@recalllens/matcher";

export type RecallSource = "cpsc" | "fda" | "usda" | "nhtsa" | "manual";

export interface IngestedCriterion {
  field: CriterionField;
  operator: CriterionOperator;
  value: unknown;
  rawText?: string;
}

export interface IngestedRecall {
  source: RecallSource;
  sourceId: string;
  title: string;
  description: string;
  brand?: string;
  productName?: string;
  category?: string;
  sourceUrl: string;
  publishedAt: Date;
  rawPayload: unknown;
  criteria: IngestedCriterion[];
}

export interface SyncResult {
  source: RecallSource;
  fetched: number;
  inserted: number;
  updated: number;
  errors: number;
  durationMs: number;
}