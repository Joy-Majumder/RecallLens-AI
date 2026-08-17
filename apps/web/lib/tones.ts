import type { Outcome } from "@recalllens/matcher";

export interface OutcomeTone {
  /** Container */
  bg: string;
  border: string;
  /** Dot indicator */
  dot: string;
  /** Headline copy */
  headline: string;
  /** Headline label (uppercase mono) */
  label: string;
}

export const OUTCOME_TONES: Record<Outcome, OutcomeTone> = {
  potential_match: {
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    label: "text-red-700",
    headline: "text-red-900",
  },
  no_match: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "text-emerald-700",
    headline: "text-emerald-900",
  },
  more_info_needed: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "text-amber-700",
    headline: "text-amber-900",
  },
  unable_to_verify: {
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    dot: "bg-neutral-400",
    label: "text-neutral-600",
    headline: "text-neutral-800",
  },
};

export function outcomeChipClass(outcome: Outcome): string {
  const t = OUTCOME_TONES[outcome];
  return `${t.bg} ${t.label} border ${t.border}`;
}