// Monthly plan: suggest a cap per category from what you actually spent.
//
// The math is always code; this file is the code. A future AI layer may
// word the plan ("delivery has crept up three months running"), but the
// numbers it talks about come from here and are testable.

export type MonthKey = string; // "2026-09"

/** The n complete months before `month`, oldest first. */
export function previousMonths(month: MonthKey, n: number): MonthKey[] {
  const [y, m] = month.split("-").map(Number);
  const out: MonthKey[] = [];
  for (let k = n; k >= 1; k--) {
    const d = new Date(y, m - 1 - k, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) throw new Error("median of nothing");
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export type Suggestion = {
  history: number[];          // cents per past month, oldest first (0 = no spend)
  suggestedCapCents: number | null;
  trend: "rising" | "falling" | "flat" | "new";
  reason: string;
};

/**
 * Suggested cap = median of the past months' spend, rounded UP to the
 * next $5. Median, not mean: one $300 concert month should not reset
 * your Fun cap for the year. Rounded up so a cap set from your own
 * typical month is one you can actually meet.
 *
 * Needs at least two months with any spend; with less, there is no
 * "typical" yet and the honest answer is no suggestion.
 */
export function suggestCap(historyCents: number[]): Suggestion {
  const active = historyCents.filter((c) => c > 0);
  if (active.length < 2) {
    return { history: historyCents, suggestedCapCents: null, trend: "new",
             reason: "not enough history yet" };
  }
  const typical = median(historyCents);
  const suggestedCapCents = Math.ceil(typical / 500) * 500;

  // Trend: last month vs the median of the ones before it, with a 15%
  // dead band so ordinary month-to-month noise reads as flat.
  const last = historyCents[historyCents.length - 1];
  const before = median(historyCents.slice(0, -1));
  let trend: Suggestion["trend"] = "flat";
  if (before > 0 && last > before * 1.15) trend = "rising";
  else if (last < before * 0.85) trend = "falling";

  return { history: historyCents, suggestedCapCents, trend,
           reason: `typical month ${(typical / 100).toFixed(2)}, rounded up to the next $5` };
}
