// Spending pace: "at this rate, where will this category end the month?"
//
// A cap bar at 60% means nothing on its own - 60% on the 25th is fine,
// 60% on the 8th is a problem. Pace turns spend-so-far into a month-end
// projection and a daily allowance, so the dashboard can warn while
// there is still time to change course. Pure functions, integer cents,
// no Date.now() inside - the caller passes the day, so tests are exact.

export type PaceStatus = "no-cap" | "on-track" | "watch" | "over-pace" | "over-cap";

export type Pace = {
  spentCents: number;
  capCents: number | null;
  projectedCents: number;   // linear projection to month end
  remainingCents: number | null;   // cap - spent (negative once over)
  dailyAllowanceCents: number | null;   // what you can spend per remaining day
  status: PaceStatus;
};

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate(); // day 0 of next month
}

/**
 * dayOfMonth is the current day (1-based); spend up to and including
 * today counts as `dayOfMonth` days elapsed. Early in the month the
 * projection is unreliable (one $40 dinner on the 2nd projects $600),
 * so before day 5 nothing is flagged "over-pace" - only "over-cap",
 * which is a fact rather than a forecast.
 */
export function computePace(spentCents: number, capCents: number | null,
                            dayOfMonth: number, totalDays: number): Pace {
  if (dayOfMonth < 1 || dayOfMonth > totalDays) throw new Error("day out of range");
  const projectedCents = Math.round((spentCents * totalDays) / dayOfMonth);
  if (capCents === null || capCents <= 0) {
    return { spentCents, capCents: null, projectedCents, remainingCents: null,
             dailyAllowanceCents: null, status: "no-cap" };
  }
  const remainingCents = capCents - spentCents;
  const daysLeft = totalDays - dayOfMonth + 1; // today still counts
  const dailyAllowanceCents = remainingCents > 0 ? Math.floor(remainingCents / daysLeft) : 0;

  let status: PaceStatus;
  if (spentCents > capCents) status = "over-cap";
  else if (dayOfMonth >= 5 && projectedCents > capCents) status = "over-pace";
  else if (dayOfMonth >= 5 && projectedCents > capCents * 0.9) status = "watch";
  else status = "on-track";

  return { spentCents, capCents, projectedCents, remainingCents, dailyAllowanceCents, status };
}
