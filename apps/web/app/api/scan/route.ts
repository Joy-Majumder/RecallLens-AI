/**
 * POST /api/scan
 *
 * multipart/form-data { image: File }
 * → Gemini extraction → deterministic matcher against local recall corpus
 * → returns the extraction plus a best match and per-recall outcomes.
 *
 * No auth. No persistence. Demo flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractProductFromPhoto } from "@recalllens/extraction";
import {
  evaluate,
  outcomeRank,
  type MatchInput,
  type Outcome,
  type Recall,
} from "@recalllens/matcher";
import { findCandidateRecalls } from "@/lib/recalls";
import type { ScanResponse } from "@/lib/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (10MB max)" }, { status: 413 });
  }

  let extraction;
  try {
    extraction = await extractProductFromPhoto({
      imageBytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Extraction failed: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 422 }
    );
  }

  const candidates = findCandidateRecalls({
    brand: extraction.brand ?? undefined,
    productName: extraction.product_name ?? undefined,
  });

  const matchInput: MatchInput = {
    product: {
      brand: extraction.brand ?? undefined,
      productName: extraction.product_name ?? undefined,
      variant: extraction.variant ?? undefined,
      category: extraction.category ?? undefined,
      lotCode: extraction.lot_code ?? undefined,
      mfgDate: extraction.mfg_date ?? undefined,
      expiryDate: extraction.expiry_date ?? undefined,
    },
    photoType: extraction.photo_type,
    productConfidence: extraction.product_confidence,
    lotConfidence: extraction.lot_confidence,
  };

  const allOutcomes: ScanResponse["allOutcomes"] = [];
  let bestRecall: Recall | null = null;
  let bestOutcome: Outcome | null = null;
  let bestConfidence = 0;
  let bestPriority = -1;

  for (const recall of candidates) {
    const match = evaluate(matchInput, recall);
    allOutcomes.push({
      recallId: recall.id,
      outcome: match.outcome,
      confidence: match.confidence,
      title: recall.title,
    });
    const priority = outcomeRank(match.outcome);
    if (priority > bestPriority) {
      bestPriority = priority;
      bestRecall = recall;
      bestOutcome = match.outcome;
      bestConfidence = match.confidence;
    }
  }

  const extractionPayload: ScanResponse["extraction"] = {
    brand: extraction.brand ?? null,
    product_name: extraction.product_name ?? null,
    lot_code: extraction.lot_code ?? null,
    photo_type: extraction.photo_type,
    product_confidence: extraction.product_confidence,
    lot_confidence: extraction.lot_confidence,
    notes: extraction.notes ?? null,
  };

  if (!bestRecall || !bestOutcome) {
    const body: ScanResponse = {
      matchId: `no-match:${Date.now()}`,
      extraction: extractionPayload,
      bestMatch: null,
      allOutcomes,
    };
    return NextResponse.json(body);
  }

  // Re-evaluate only for the winner to get its rule trace.
  const winnerRules = evaluate(matchInput, bestRecall).rules;

  const body: ScanResponse = {
    matchId: bestRecall.id,
    extraction: extractionPayload,
    bestMatch: {
      recallId: bestRecall.id,
      outcome: bestOutcome,
      confidence: bestConfidence,
      message: messageFor(bestOutcome),
      rules: winnerRules,
      recall: {
        title: bestRecall.title,
        source: bestRecall.source,
        sourceUrl: bestRecall.sourceUrl,
      },
    },
    allOutcomes,
  };
  return NextResponse.json(body);
}

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