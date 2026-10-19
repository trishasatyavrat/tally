// The monthly plan: for each category, the last three months, this
// month's pace, your cap, and a suggested cap from your own history.
//
// All numbers come from src/lib/plan.ts and src/lib/pace.ts. The page
// only queries and renders.
import { db } from "@/lib/db";
import { formatUSD } from "@/lib/money";
import { currentMonth } from "@/lib/dates";
import { computePace, daysInMonth } from "@/lib/pace";
import { previousMonths, suggestCap } from "@/lib/plan";
import { decimalStringToCents } from "@/lib/split";
import { centsToDecimalString } from "@/lib/csv";
import { Nav } from "@/components/nav";
import { spendByCategoryMonth, spendKey } from "@/lib/spend";
import { getOrCreateDemoUser, setBudget } from "@/app/actions";

export const dynamic = "force-dynamic";

const usd = (cents: number) => formatUSD(cents / 100);
const TREND: Record<string, string> = { rising: "↑ rising", falling: "↓ falling", flat: "flat", new: "new" };

export default async function PlanPage() {
  const user = await getOrCreateDemoUser();
  const month = currentMonth();
  const [year, mon] = month.split("-").map(Number);
  const past = previousMonths(month, 3);
  const from = new Date(year, mon - 1 - 3, 1);
  const to = new Date(year, mon, 1);

  // Spend per category per month: personal in full, group expenses at
  // your share. Same source as the dashboard (src/lib/spend.ts).
  const spendMap = await spendByCategoryMonth(user.id, from, to);

  const [categories, budgets] = await Promise.all([
    db.category.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] }, orderBy: { name: "asc" } }),
    db.budget.findMany({ where: { userId: user.id, month } }),
  ]);

  const cap = new Map(budgets.map((b) => [b.categoryId, decimalStringToCents(b.capAmount.toString())]));
  const today = new Date().getDate();
  const totalDays = daysInMonth(year, mon);
  const monthLabel = (m: string) =>
    new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "short" });

  const plan = categories.map((c) => {
    const history = past.map((m) => spendMap.get(spendKey(c.id, m)) ?? 0);
    const current = spendMap.get(spendKey(c.id, month)) ?? 0;
    return { c, history, s: suggestCap(history), cap: cap.get(c.id) ?? null,
             pace: computePace(current, cap.get(c.id) ?? null, today, totalDays) };
  });

  return (
    <main className="mx-auto max-w-4xl p-6 font-sans">
      <Nav current="/plan" />
      <h1 className="mb-1 text-2xl font-semibold">Plan for {month}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Suggested caps are your typical month over the last three (the median, so one
        unusual month does not move it), rounded up to the next $5.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-2 pr-3">Category</th>
              {past.map((m) => <th key={m} className="py-2 pr-3 text-right">{monthLabel(m)}</th>)}
              <th className="py-2 pr-3">Trend</th>
              <th className="py-2 pr-3 text-right">This month (pace)</th>
              <th className="py-2 pr-3 text-right">Cap</th>
              <th className="py-2 text-right">Suggested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {plan.map(({ c, history, s, cap, pace }) => (
              <tr key={c.id}>
                <td className="py-2 pr-3">{c.emoji} {c.name}</td>
                {history.map((h, i) => (
                  <td key={i} className="py-2 pr-3 text-right tabular-nums text-zinc-600">{h ? usd(h) : "—"}</td>
                ))}
                <td className={`py-2 pr-3 text-xs ${s.trend === "rising" ? "text-orange-600" : "text-zinc-500"}`}>
                  {TREND[s.trend]}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {usd(pace.spentCents)}
                  {pace.spentCents > 0 && <span className="text-xs text-zinc-400"> → {usd(pace.projectedCents)}</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{cap !== null ? usd(cap) : "—"}</td>
                <td className="py-2 text-right">
                  {s.suggestedCapCents === null ? (
                    <span className="text-xs text-zinc-400" title={s.reason}>not enough history</span>
                  ) : s.suggestedCapCents === cap ? (
                    <span className="tabular-nums text-zinc-500">{usd(s.suggestedCapCents)} ✓</span>
                  ) : (
                    <form action={setBudget} className="inline">
                      <input type="hidden" name="categoryId" value={c.id} />
                      <input type="hidden" name="capAmount" value={centsToDecimalString(s.suggestedCapCents)} />
                      <button className="rounded border border-zinc-300 px-2 py-0.5 text-xs tabular-nums" title={s.reason}>
                        use {usd(s.suggestedCapCents)}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
