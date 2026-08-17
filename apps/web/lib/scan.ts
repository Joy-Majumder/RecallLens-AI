import type { MatchResult, Outcome } from "@recalllens/matcher";

/** Fields the result UI actually renders. Keep this minimal — the full
 * extraction stays on the server. */
export interface ScanResponse {
  matchId: string;
  extraction: {
    brand: string | null;
    product_name: string | null;
    lot_code: string | null;
    photo_type: string;
    product_confidence: number;
    lot_confidence: number;
    notes: string | null;
  };
  bestMatch: {
    recallId: string;
    outcome: Outcome;
    confidence: number;
    message: string;
    rules: MatchResult["rules"];
    recall: {
      title: string;
      source: string;
      sourceUrl: string;
    };
  } | null;
  allOutcomes: Array<{
    recallId: string;
    outcome: Outcome;
    confidence: number;
    title: string;
  }>;
}