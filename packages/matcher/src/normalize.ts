/**
 * String canonicalization for matching.
 *
 * Real recall notices have inconsistent capitalization, punctuation, and
 * whitespace. Lot codes get misread as "A 100" vs "A100" vs "A-100".
 * Before any rule runs, we normalize the input.
 */

export function normalizeString(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[\s\-_./\\]+/g, "") // strip spaces, hyphens, slashes, dots
    .replace(/[''`]/g, "") // strip smart quotes
    .replace(/[™®©]/g, "") // strip trademark markers
    .trim();
}

/**
 * Strict normalization that preserves internal structure for alphanumeric
 * codes (e.g. lot codes) — strips spaces and hyphens, uppercases.
 * "a-100" → "A100", "BATCH 2024" → "BATCH2024"
 */
export function normalizeCode(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s\-_./\\]+/g, "");
}

/**
 * Levenshtein-based similarity, returning 0..1.
 * Used for fuzzy brand matching.
 */
export function similarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev: number[] = new Array(b.length + 1);
  const curr: number[] = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1, // insertion
        (prev[j] ?? 0) + 1, // deletion
        (prev[j - 1] ?? 0) + cost // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }

  return prev[b.length] ?? 0;
}