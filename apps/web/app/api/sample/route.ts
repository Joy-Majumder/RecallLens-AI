/**
 * GET /api/sample?id=<sampleId>
 *
 * Demo helper: returns the same shape as POST /api/scan, but without
 * calling Gemini. Used by the "Try a sample" dropdown on the scan page
 * so the demo can show any outcome without needing a physical product.
 */
import { NextRequest, NextResponse } from "next/server";
import { listSamples, runSample, type SampleId } from "@/lib/samples";
import type { ScanResponse } from "@/lib/scan";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") as SampleId | null;
  if (!id) {
    return NextResponse.json({
      samples: listSamples().map((s) => ({ id: s.id, label: s.label })),
    });
  }

  const result: ScanResponse | null = runSample(id);
  if (!result) {
    return NextResponse.json({ error: "Unknown sample id" }, { status: 404 });
  }
  return NextResponse.json(result);
}