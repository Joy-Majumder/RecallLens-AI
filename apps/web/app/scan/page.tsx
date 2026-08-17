"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanResponse } from "@/lib/scan";
import { OUTCOME_TONES, outcomeChipClass } from "@/lib/tones";

export default function ScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setError(null);
    setResult(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const body = (await res.json()) as ScanResponse | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `Server ${res.status}`);
      }
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    pickFile(null);
  }

  async function runSample(id: string) {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/sample?id=${encodeURIComponent(id)}`);
      const body = (await res.json()) as ScanResponse | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `Server ${res.status}`);
      }
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <PageHeader />

        <section className="mt-12">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
            Scan
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Upload a photo of the product
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            Make sure the lot code, batch stamp, or date stamp is in focus.
            Often on the bottom or back of the package.
          </p>
        </section>

        <section className="mt-10">
          {!preview && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="block w-full rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-6 py-20 text-left transition hover:border-neutral-500 hover:bg-neutral-100"
            >
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                Upload
              </p>
              <p className="mt-3 text-base font-medium text-neutral-900">
                Tap to choose a photo
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                JPG, PNG, or HEIC up to 10MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </button>
          )}

          {preview && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Selected product"
                className="w-full rounded-md border border-neutral-200"
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
                >
                  {submitting ? "Analyzing..." : "Check for recalls"}
                  {!submitting && <span aria-hidden>→</span>}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  Choose another
                </button>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <SamplePicker onPick={runSample} disabled={submitting} />
        </section>

        {result && (
          <section className="mt-16 border-t border-neutral-200 pt-10">
            <ResultPanel result={result} />
          </section>
        )}
      </div>
    </main>
  );
}

function PageHeader() {
  // Inline header for client component (avoids importing the server one).
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
      <a href="/" className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-sm bg-neutral-900" />
        <span className="font-mono text-sm tracking-tight text-neutral-600">
          RecallLens
        </span>
      </a>
      <nav className="flex gap-6 text-sm text-neutral-600">
        <a href="/" className="hover:text-neutral-900">
          Home
        </a>
        <a href="/scan" className="hover:text-neutral-900">
          Scan
        </a>
      </nav>
    </header>
  );
}

function ResultPanel({ result }: { result: ScanResponse }) {
  const ext = result.extraction;
  const best = result.bestMatch;

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
        Result
      </p>

      <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          What we read
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Field label="Brand" value={ext.brand} />
          <Field label="Product" value={ext.product_name} />
          <Field label="Lot code" value={ext.lot_code} mono />
          <Field label="Photo type" value={ext.photo_type} />
          <Field
            label="Confidence"
            value={`product ${(ext.product_confidence * 100).toFixed(0)}% / lot ${(ext.lot_confidence * 100).toFixed(0)}%`}
          />
        </dl>
        {ext.notes && <p className="mt-3 text-xs text-neutral-500">{ext.notes}</p>}
      </div>

      <div className="mt-6">
        <BestMatch best={best} />
      </div>

      {result.allOutcomes.length > 1 && (
        <div className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
            All recall checks
          </p>
          <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
            {result.allOutcomes.map((o) => (
              <li
                key={o.recallId}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <p className="text-neutral-900">{o.title}</p>
                  <p className="font-mono text-xs text-neutral-500">{o.recallId}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${outcomeChipClass(o.outcome)}`}
                  >
                    {o.outcome.replace("_", " ")}
                  </span>
                  <span className="font-mono text-xs text-neutral-500">
                    {(o.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SamplePicker({
  onPick,
  disabled,
}: {
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-10 rounded-md border border-neutral-200 bg-neutral-50 px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          Try a sample scan
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
          No Gemini call
        </p>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Each sample runs the real matcher against the local recall corpus —
        no photo, no API key, instant result.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.id)}
            className="rounded-md border border-neutral-300 bg-white px-4 py-3 text-left text-sm transition hover:border-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
          >
            <span className="font-medium text-neutral-900">{s.label}</span>
            <span className="mt-1 block text-xs text-neutral-500">
              {s.blurb}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const SAMPLES = [
  {
    id: "match-goodgather",
    label: "Potential match — Good & Gather lot 4169",
    blurb:
      "Scan of a baby food pouch bottom showing lot 4169 — within the recalled range.",
  },
  {
    id: "nomatch-goodgather",
    label: "No match — Good & Gather safe lot",
    blurb:
      "Same product line, different lot. Identity match, lot outside range.",
  },
  {
    id: "info-needed",
    label: "More info needed — front of package",
    blurb: "Front of a Dove bar — no lot code visible.",
  },
  {
    id: "out-of-scope",
    label: "No matching recalls — unrelated product",
    blurb: "Brand/product don't overlap anything in the corpus.",
  },
];

function BestMatch({ best }: { best: ScanResponse["bestMatch"] }) {
  if (!best) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-5 py-4">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            No matching recalls
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            We checked the product against active recall data and did not find
            any matches within scope.
          </p>
        </div>
      </div>
    );
  }

  const tone = OUTCOME_TONES[best.outcome];

  return (
    <div className={`flex items-start gap-3 rounded-md border ${tone.border} ${tone.bg} px-5 py-5`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      <div className="flex-1">
        <p className={`font-mono text-[11px] uppercase tracking-widest ${tone.label}`}>
          {best.outcome.replace("_", " ")} · {(best.confidence * 100).toFixed(0)}%
        </p>
        <p className={`mt-2 text-sm ${tone.headline}`}>{best.message}</p>

        <div className="mt-4 border-t border-neutral-200/60 pt-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
            Recall
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {best.recall.title}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-neutral-500">
            {best.recall.source} · {best.recallId}
          </p>
          <a
            href={best.recall.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1 text-sm text-neutral-700 underline decoration-neutral-400 underline-offset-4 hover:decoration-neutral-900"
          >
            View official notice
            <span aria-hidden>↗</span>
          </a>
        </div>

        <div className="mt-4 border-t border-neutral-200/60 pt-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
            Why this outcome
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {best.rules.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    r.passed ? "bg-neutral-700" : "bg-neutral-300"
                  }`}
                />
                <span className="text-neutral-700">{r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono" : ""} text-neutral-900`}>
        {value ?? <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}