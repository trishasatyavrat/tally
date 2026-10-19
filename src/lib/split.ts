// Dividing a shared expense, and turning Split rows into settle-up input.
//
// Splitting $10.00 three ways is 333, 333, 334 cents - never 333.33.
// Integer cents, remainder handed out deterministically, so the shares
// always sum to the total and the same input gives the same answer.
import type { Transfer } from "./settle";
import { settleFromSplits } from "./settle";

/** Equal split: the first (total % n) people get one extra cent. */
export function equalSplitCents(totalCents: number, n: number): number[] {
  if (n <= 0) throw new Error("split among at least one person");
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error("amount must be whole cents");
  const base = Math.floor(totalCents / n);
  const extra = totalCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** "12.34" (Prisma Decimal string) -> 1234. */
export function decimalStringToCents(s: string): number {
  const m = s.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw new Error(`not a money amount: ${s}`);
  const cents = parseInt(m[2], 10) * 100 + parseInt((m[3] ?? "").padEnd(2, "0"), 10);
  return m[1] ? -cents : cents;
}

export type SplitRow = { amount: string; owedById: string; settled: boolean; expense: { userId: string } };
export type PaymentRow = { amount: string; fromUserId: string; toUserId: string };
type NetInput = { paidByUserId: string; owedByUserId: string; amountCents: number };

/**
 * A payment from A to B is netted exactly like a split where A paid for
 * B: A's balance goes up by the amount, B's goes down. If A owed B $20
 * and pays $20, A's -20 and B's +20 both return to zero. One netting
 * function, two kinds of facts.
 */
export function paymentsAsSplits(payments: PaymentRow[]): NetInput[] {
  return payments.map((p) => ({
    paidByUserId: p.fromUserId,
    owedByUserId: p.toUserId,
    amountCents: decimalStringToCents(p.amount),
  }));
}

export function netInputs(rows: SplitRow[], payments: PaymentRow[] = []): NetInput[] {
  return [
    ...rows.filter((r) => !r.settled).map((r) => ({
      paidByUserId: r.expense.userId,
      owedByUserId: r.owedById,
      amountCents: decimalStringToCents(r.amount),
    })),
    ...paymentsAsSplits(payments),
  ];
}

/** Unsettled Split rows plus recorded payments -> who should still pay whom. */
export function transfersFromSplitRows(rows: SplitRow[], payments: PaymentRow[] = []): Transfer[] {
  return settleFromSplits(netInputs(rows, payments));
}
