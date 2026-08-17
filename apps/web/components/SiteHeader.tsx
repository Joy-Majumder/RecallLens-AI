import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
      <Link href="/" className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-sm bg-neutral-900" />
        <span className="font-mono text-sm tracking-tight text-neutral-600">
          RecallLens
        </span>
      </Link>
      <nav className="flex gap-6 text-sm text-neutral-600">
        <Link href="/" className="hover:text-neutral-900">
          Home
        </Link>
        <Link href="/scan" className="hover:text-neutral-900">
          Scan
        </Link>
      </nav>
    </header>
  );
}