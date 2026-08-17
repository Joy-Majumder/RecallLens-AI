import { evaluate, type Outcome } from "@recalllens/matcher";
import { findCandidateRecalls } from "@/lib/recalls";
import type { ScanResponse } from "@/lib/scan";

/**
 * Canned test cases for demos. Each entry describes a plausible product
 * scan: extraction fields + canned lot/date — the matcher runs against
 * the real local recall corpus so the result is authentic.
 *
 * Used by /api/sample so judges can demo any outcome without needing
 * a physical product.
 */
export type SampleId =
  | "match-goodgather"
  | "nomatch-goodgather"
  | "info-needed"
  | "out-of-scope";

export interface SampleSpec {
  id: SampleId;
  label: string;
  blurb: string;
  extraction: ScanResponse["extraction"];
}

const SAMPLES: SampleSpec[] = [
  {
    id: "match-goodgather",
    label: "Potential match — Good & Gather lot 4169",
    blurb:
      "Scan of a baby food pouch bottom showing lot 4169 — within the recalled range.",
    extraction: {
      brand: "Good & Gather",
      product_name: "Baby Vegetable Puree",
      lot_code: "4169",
      photo_type: "back_only",
      product_confidence: 0.96,
      lot_confidence: 0.93,
      notes: "Lot code stamped on the bottom crimp; brand on the lid.",
    },
  },
  {
    id: "nomatch-goodgather",
    label: "No match — Good & Gather safe lot",
    blurb:
      "Same product line, different lot. Demonstrates identity match but rejection.",
    extraction: {
      brand: "Good & Gather",
      product_name: "Baby Vegetable Puree",
      lot_code: "5102",
      photo_type: "back_only",
      product_confidence: 0.95,
      lot_confidence: 0.92,
      notes: "Lot code stamped on bottom crimp.",
    },
  },
  {
    id: "info-needed",
    label: "More info needed — front of package",
    blurb:
      "Front of a Good & Gather pouch — lot code hidden. Recall active but undecidable.",
    extraction: {
      brand: "Good & Gather",
      product_name: "Baby Vegetable Puree",
      lot_code: null,
      photo_type: "front_only",
      product_confidence: 0.94,
      lot_confidence: 0.0,
      notes:
        "Front of package only — lot code, manufacturing date, and expiry date are on the bottom crimp.",
    },
  },
  {
    id: "out-of-scope",
    label: "No matching recalls — unrelated product",
    blurb:
      "Brand/product don't overlap anything in the corpus; matcher never runs.",
    extraction: {
      brand: "Acme",
      product_name: "Sparkling Water",
      lot_code: "A100",
      photo_type: "back_only",
      product_confidence: 0.94,
      lot_confidence: 0.88,
      notes: null,
    },
  },
];

export function listSamples(): SampleSpec[] {
  return SAMPLES;
}

const OUTCOME_PRIORITY: Record<Outcome, number> = {
  potential_match: 4,
  more_info_needed: 3,
  unable_to_verify: 2,
  no_match: 1,
};

export function runSample(id: SampleId): ScanResponse | null {
  const spec = SAMPLES.find((s) => s.id === id);
  if (!spec) return null;

  const candidates = findCandidateRecalls({
    brand: spec.extraction.brand ?? undefined,
    productName: spec.extraction.product_name ?? undefined,
  });

  const allOutcomes: ScanResponse["allOutcomes"] = [];
  let bestRecallId: string | null = null;
  let bestOutcome: Outcome | null = null;
  let bestConfidence = 0;
  let bestPriority = -1;

  for (const recall of candidates) {
    const match = evaluate(
      {
        product: {
          brand: spec.extraction.brand ?? undefined,
          productName: spec.extraction.product_name ?? undefined,
          lotCode: spec.extraction.lot_code ?? undefined,
          category: undefined,
        },
        photoType: spec.extraction.photo_type as PhotoType,
        productConfidence: spec.extraction.product_confidence,
        lotConfidence: spec.extraction.lot_confidence,
      },
      recall,
    );
    allOutcomes.push({
      recallId: recall.id,
      outcome: match.outcome,
      confidence: match.confidence,
      title: recall.title,
    });
    const priority = OUTCOME_PRIORITY[match.outcome];
    if (priority > bestPriority) {
      bestPriority = priority;
      bestRecallId = recall.id;
      bestOutcome = match.outcome;
      bestConfidence = match.confidence;
    }
  }

  if (!bestRecallId || !bestOutcome) {
    return {
      matchId: `no-match:${id}`,
      extraction: spec.extraction,
      bestMatch: null,
      allOutcomes,
    };
  }

  const winner = candidates.find((r) => r.id === bestRecallId)!;
  const winnerMatch = evaluate(
    {
      product: {
        brand: spec.extraction.brand ?? undefined,
        productName: spec.extraction.product_name ?? undefined,
        lotCode: spec.extraction.lot_code ?? undefined,
      },
      photoType: spec.extraction.photo_type as PhotoType,
      productConfidence: spec.extraction.product_confidence,
      lotConfidence: spec.extraction.lot_confidence,
    },
    winner,
  );

  return {
    matchId: winner.id,
    extraction: spec.extraction,
    bestMatch: {
      recallId: winner.id,
      outcome: bestOutcome,
      confidence: bestConfidence,
      message: messageFor(bestOutcome),
      rules: winnerMatch.rules,
      recall: {
        title: winner.title,
        source: winner.source,
        sourceUrl: winner.sourceUrl,
      },
    },
    allOutcomes,
  };
}

type PhotoType = "full_product" | "front_only" | "back_only" | "unclear";

function messageFor(outcome: Outcome): string {
  switch (outcome) {
    case "potential_match":
      return "Based on the identifiers we read, this product falls within the recalled range.";
    case "no_match":
      return "This product matches the brand/product, but the lot code or date is outside the recalled range.";
    case "more_info_needed":
      return "We couldn't confidently read enough information to make a determination. The detail below tells you exactly what to capture.";
    case "unable_to_verify":
      return "This recall notice doesn't contain enough structured detail for us to check your product against it.";
  }
}