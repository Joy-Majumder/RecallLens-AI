import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SiteHeader />

        <section className="mt-20 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
            Recall verification
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">
            Check the unit in your hand.
          </h1>
          <p className="mt-6 text-lg text-neutral-600">
            Most recall apps match on barcodes, which are identical across every
            unit of a product. RecallLens reads the lot code, batch stamp, or
            date off the package and compares it to the specific criteria in
            each recall.
          </p>
          <div className="mt-10">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Scan a product
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        <section className="mt-24 border-t border-neutral-200 pt-12">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <Step n="01" title="Reads the package">
              We extract brand, product, variant, lot code, and dates from a
              single photo using structured extraction.
            </Step>
            <Step n="02" title="Rule-based engine">
              A deterministic matcher compares what was read against each
              recall's criteria. No guessing, no black box.
            </Step>
            <Step n="03" title="Links to the source">
              Every result points back to the official recall notice. The final
              call is yours.
            </Step>
          </div>
        </section>

        <section className="mt-24 border-t border-neutral-200 pt-12">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
            Four honest outcomes
          </p>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Outcome
              label="Potential match"
              desc="Identifiers fall within the recalled range."
              dotClass="bg-red-500"
            />
            <Outcome
              label="No match"
              desc="Brand/product match but lot/date is outside the recall."
              dotClass="bg-emerald-500"
            />
            <Outcome
              label="More info needed"
              desc="Couldn't read enough to decide. We'll tell you what to capture."
              dotClass="bg-amber-500"
            />
            <Outcome
              label="Unable to verify"
              desc="The notice lacks structured criteria we can check."
              dotClass="bg-neutral-400"
            />
          </div>
        </section>

        <footer className="mt-24 border-t border-neutral-200 pt-8 text-xs text-neutral-500">
          <p>
            RecallLens is a verification tool, not a certified safety authority.
            Confirm any result with the original recall notice.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
        {n} — {title.split(" ")[0]}
      </p>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{children}</p>
    </div>
  );
}

function Outcome({
  label,
  desc,
  dotClass,
}: {
  label: string;
  desc: string;
  dotClass: string;
}) {
  return (
    <div className="flex gap-3 border-l border-neutral-200 pl-4">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-sm text-neutral-600">{desc}</p>
      </div>
    </div>
  );
}