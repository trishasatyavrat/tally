// The dashboard: this month's spending per category against its cap,
// plus expense entry.
//
// This is a React Server Component - it runs on the server, queries the
// database directly, and ships HTML. No API layer, no client-side data
// fetching, no loading spinner.
import { db } from "@/lib/db";
import { formatUSD, percentOfCap } from "@/lib/money";
import { addExpense, setBudget, getOrCreateDemoUser } from "./actions";
import { currentMonth } from "@/lib/dates";
import { Nav } from "@/components/nav";

export default async function Dashboard() {
  const user = await getOrCreateDemoUser();
  const month = currentMonth();
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 1);

  const [categories, budgets, expenses, totals] = await Promise.all([
    db.category.findMany({
      where: { OR: [{ userId: null }, { userId: user.id }] },
      orderBy: { name: "asc" },
    }),
    db.budget.findMany({ where: { userId: user.id, month } }),
    db.expense.findMany({
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 20,
    }),
    // Aggregate in the database rather than summing in JS: it is one
    // round-trip instead of N, and Postgres sums Decimals exactly.
    db.expense.groupBy({
      by: ["categoryId"],
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = new Map(
    totals.map((t) => [t.categoryId, Number(t._sum.amount ?? 0)])
  );
  const capByCategory = new Map(
    budgets.map((b) => [b.categoryId, Number(b.capAmount)])
  );
  const monthTotal = [...spentByCategory.values()].reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      <Nav current="/" />
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">This month</h1>
        <p className="text-sm text-zinc-500">
          {month} — {formatUSD(monthTotal)} spent this month
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Add expense
        </h2>
        <form action={addExpense} className="flex flex-wrap gap-2">
          <input
            name="description" placeholder="Chipotle" required
            className="flex-1 min-w-40 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="amount" placeholder="12.40" inputMode="decimal" required
            className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            name="categoryId"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">
            Add
          </button>
        </form>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Categories
        </h2>
        <ul className="space-y-3">
          {categories.map((c) => {
            const spent = spentByCategory.get(c.id) ?? 0;
            const cap = capByCategory.get(c.id) ?? null;
            const pct = percentOfCap(spent, cap);
            const over = cap !== null && spent > cap;
            return (
              <li key={c.id} className="rounded border border-zinc-200 p-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{c.emoji} {c.name}</span>
                  <span className={over ? "font-medium text-red-600" : "text-zinc-600"}>
                    {formatUSD(spent)}{cap !== null && ` / ${formatUSD(cap)}`}
                  </span>
                </div>
                {pct !== null && (
                  <div className="mt-2 h-2 w-full rounded bg-zinc-100">
                    <div
                      className={`h-2 rounded ${over ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <form action={setBudget} className="mt-2 flex gap-2">
                  <input type="hidden" name="categoryId" value={c.id} />
                  <input
                    name="capAmount" placeholder="set cap" inputMode="decimal"
                    className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs"
                  />
                  <button className="text-xs text-zinc-500 underline">save</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Recent
        </h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing logged yet this month.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="flex justify-between py-2">
                <span>
                  {e.description}
                  <span className="ml-2 text-xs text-zinc-400">
                    {e.category ? `${e.category.emoji} ${e.category.name}` : "uncategorized"}
                  </span>
                </span>
                <span className="tabular-nums">{formatUSD(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
