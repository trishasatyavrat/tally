// Settle-up: turn a web of "who owes whom" into the fewest payments.
//
// The problem: after a trip, A owes B $20, B owes C $20, C owes A $5.
// Paying each debt directly is 3 transfers. But B is net flat (owed 20,
// owes 20), so the whole thing collapses to A pays C $15. Nobody wants
// to make transfers that cancel out.
//
// The approach: reduce every debt to a single NET balance per person
// (negative = owes money, positive = is owed), then repeatedly match
// the largest debtor against the largest creditor. Each match settles
// at least one person completely, so with n people who have non-zero
// balances the result is at most n-1 transfers.
//
// Note this is a greedy heuristic, not a proven optimum. Finding the
// true minimum number of transactions is NP-hard (it reduces to set
// partitioning), so production apps - Splitwise included - use exactly
// this kind of greedy pass. It is optimal in the common cases and never
// worse than n-1.

export type Balance = { userId: string; amountCents: number };
export type Transfer = { fromUserId: string; toUserId: string; amountCents: number };

/**
 * Compute net balances from raw splits.
 * Each split says: `owedBy` owes `paidBy` this much for one expense.
 * Money is in integer cents - never floats, so sums are exact.
 */
export function netBalances(
  splits: { paidByUserId: string; owedByUserId: string; amountCents: number }[]
): Balance[] {
  const net = new Map<string, number>();
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);

  for (const s of splits) {
    if (s.paidByUserId === s.owedByUserId) continue; // owing yourself is a no-op
    bump(s.paidByUserId, s.amountCents);   // they are owed this much
    bump(s.owedByUserId, -s.amountCents);  // they owe this much
  }

  return [...net.entries()]
    .map(([userId, amountCents]) => ({ userId, amountCents }))
    .filter((b) => b.amountCents !== 0);
}

/**
 * Greedy settle-up. Returns the transfers that zero every balance.
 *
 * Sorting is by amount, so the largest debt meets the largest credit
 * first - that is what makes each step settle someone completely
 * rather than leaving two partial balances behind.
 */
export function settleUp(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.amountCents < 0)
    .map((b) => ({ ...b, amountCents: -b.amountCents })) // copy + work in positives
    .sort((a, b) => b.amountCents - a.amountCents);
  const creditors = balances
    .filter((b) => b.amountCents > 0)
    .map((b) => ({ ...b })) // copy: filter clones the array, NOT the objects,
    .sort((a, b) => b.amountCents - a.amountCents); // and we mutate below

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amountCents, creditors[j].amountCents);
    if (pay > 0) {
      transfers.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amountCents: pay,
      });
    }
    debtors[i].amountCents -= pay;
    creditors[j].amountCents -= pay;
    // Whoever hit zero is done; at least one does every iteration,
    // which is what guarantees this terminates.
    if (debtors[i].amountCents === 0) i++;
    if (creditors[j].amountCents === 0) j++;
  }

  return transfers;
}

/** Convenience: raw splits straight to the payments people should make. */
export function settleFromSplits(
  splits: { paidByUserId: string; owedByUserId: string; amountCents: number }[]
): Transfer[] {
  return settleUp(netBalances(splits));
}
