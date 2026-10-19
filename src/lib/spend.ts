// What you actually spent, per category per month.
//
// Personal expenses count in full. A group expense counts only your
// share (myShareCents): if you paid $30 for three people, $10 is your
// spending and $20 is money your friends owe you; if a friend paid, your
// split is your spending even though it never touched your card.
// The dashboard and /plan both read from here, so they cannot disagree.
import { db } from "@/lib/db";
import { decimalStringToCents, myShareCents } from "@/lib/split";

export type SpendKey = string; // `${categoryId ?? "null"}|${YYYY-MM}`
export const spendKey = (categoryId: string | null, month: string): SpendKey => `${categoryId ?? "null"}|${month}`;

const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export async function spendByCategoryMonth(userId: string, from: Date, to: Date): Promise<Map<SpendKey, number>> {
  // Personal spending: summed in Postgres, as before. Parameterized.
  const personal = await db.$queryRaw<{ categoryId: string | null; m: string; total: string }[]>`
    SELECT "categoryId", to_char("date", 'YYYY-MM') AS m, SUM("amount")::text AS total
    FROM "Expense"
    WHERE "userId" = ${userId} AND "groupId" IS NULL AND "date" >= ${from} AND "date" < ${to}
    GROUP BY 1, 2`;

  // Group expenses you paid or owe a split on. Shares need the splits,
  // so these come back as rows and are reduced in cents.
  const shared = await db.expense.findMany({
    where: {
      groupId: { not: null }, date: { gte: from, lt: to },
      OR: [{ userId }, { splits: { some: { owedById: userId } } }],
    },
    select: { userId: true, amount: true, date: true, categoryId: true,
              splits: { select: { owedById: true, amount: true } } },
  });

  const out = new Map<SpendKey, number>();
  const bump = (k: SpendKey, c: number) => out.set(k, (out.get(k) ?? 0) + c);
  for (const r of personal) bump(spendKey(r.categoryId, r.m), decimalStringToCents(r.total));
  for (const e of shared) {
    const share = myShareCents({
      userId: e.userId, amount: e.amount.toString(),
      splits: e.splits.map((s) => ({ owedById: s.owedById, amount: s.amount.toString() })),
    }, userId);
    if (share) bump(spendKey(e.categoryId, monthOf(e.date)), share);
  }
  return out;
}
