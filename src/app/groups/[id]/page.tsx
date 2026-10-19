// One group: members, shared expenses, who owes whom.
//
// Balances and transfers are computed on every request from the Split
// rows (settle.ts) - there is no stored "balance" to get out of sync.
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatUSD } from "@/lib/money";
import { transfersFromSplitRows, netInputs } from "@/lib/split";
import { netBalances } from "@/lib/settle";
import { centsToDecimalString } from "@/lib/csv";
import { Nav } from "@/components/nav";
import { getOrCreateDemoUser } from "@/app/actions";
import { addMember, addSharedExpense, settleGroup, recordPayment } from "../actions";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getOrCreateDemoUser();
  const group = await db.group.findFirst({
    where: { id, members: { some: { userId: me.id } } },
    include: {
      members: { include: { user: true }, orderBy: { user: { name: "asc" } } },
      expenses: {
        include: { user: true, splits: { include: { owedBy: true } } },
        orderBy: { date: "desc" },
      },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!group) notFound();

  const nameOf = new Map(group.members.map((m) => [m.userId, m.user.name]));
  const splitRows = group.expenses.flatMap((e) =>
    e.splits.map((s) => ({ amount: s.amount.toString(), owedById: s.owedById, settled: s.settled, expense: { userId: e.userId } }))
  );
  const open = splitRows.filter((r) => !r.settled);
  const paymentRows = group.payments.map((p) => ({
    amount: p.amount.toString(), fromUserId: p.fromUserId, toUserId: p.toUserId,
  }));
  // Payments net against splits (src/lib/split.ts), so balances and the
  // settle-up list both reflect what has actually been paid.
  const balances = netBalances(netInputs(splitRows, paymentRows));
  const transfers = transfersFromSplitRows(splitRows, paymentRows);
  const money = (cents: number) => formatUSD(cents / 100);

  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      <Nav current="/groups" />
      <h1 className="mb-1 text-2xl font-semibold">{group.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">{group.members.map((m) => m.user.name).join(" · ")}</p>

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Balances</h2>
          {balances.length === 0 ? (
            <p className="text-sm text-zinc-500">Everyone is square.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {balances.map((b) => (
                <li key={b.userId} className="flex justify-between">
                  <span>{nameOf.get(b.userId)}</span>
                  <span className={`tabular-nums ${b.amountCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {b.amountCents < 0 ? `owes ${money(-b.amountCents)}` : `is owed ${money(b.amountCents)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Settle up</h2>
          {transfers.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing to pay.</p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {transfers.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{nameOf.get(t.fromUserId)}</span> pays{" "}
                      <span className="font-medium">{nameOf.get(t.toUserId)}</span>{" "}
                      <span className="tabular-nums">{money(t.amountCents)}</span>
                    </span>
                    {/* One click records exactly this transfer as paid. */}
                    <form action={recordPayment}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="fromUserId" value={t.fromUserId} />
                      <input type="hidden" name="toUserId" value={t.toUserId} />
                      <input type="hidden" name="amount" value={centsToDecimalString(t.amountCents)} />
                      <button className="rounded border border-zinc-300 px-2 py-0.5 text-xs">paid</button>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-zinc-500">
                {transfers.length} payment{transfers.length === 1 ? "" : "s"} instead of {open.length} debts.
              </p>
              <form action={settleGroup} className="mt-3">
                <input type="hidden" name="groupId" value={group.id} />
                <button className="rounded border border-zinc-300 px-3 py-1.5 text-xs">Mark everything settled</button>
              </form>
            </>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Add shared expense</h2>
        <form action={addSharedExpense} className="space-y-2">
          <input type="hidden" name="groupId" value={group.id} />
          <div className="flex flex-wrap gap-2">
            <input name="description" placeholder="Groceries" required
              className="min-w-40 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
            <input name="amount" placeholder="48.20" inputMode="decimal" required
              className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm" />
            <select name="paidById" defaultValue={me.id} className="rounded border border-zinc-300 px-3 py-2 text-sm">
              {group.members.map((m) => (
                <option key={m.userId} value={m.userId}>paid by {m.user.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-zinc-500">split equally among:</span>
            {group.members.map((m) => (
              <label key={m.userId} className="flex items-center gap-1">
                <input type="checkbox" name="participants" value={m.userId} defaultChecked /> {m.user.name}
              </label>
            ))}
          </div>
          <button className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Add</button>
        </form>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Expenses</h2>
        {group.expenses.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {group.expenses.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex justify-between">
                  <span>{e.description} <span className="text-xs text-zinc-400">paid by {e.user.name}</span></span>
                  <span className="tabular-nums">{formatUSD(e.amount)}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {e.splits.map((s) => `${s.owedBy.name} owes ${formatUSD(s.amount)}${s.settled ? " (settled)" : ""}`).join(" · ") || "no one else owes anything"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Record a payment</h2>
        <form action={recordPayment} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="groupId" value={group.id} />
          <select name="fromUserId" className="rounded border border-zinc-300 px-2 py-1.5">
            {group.members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
          </select>
          <span className="text-zinc-500">paid</span>
          <select name="toUserId" defaultValue={me.id} className="rounded border border-zinc-300 px-2 py-1.5">
            {group.members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
          </select>
          <input name="amount" placeholder="14.20" inputMode="decimal" required
            className="w-24 rounded border border-zinc-300 px-2 py-1.5" />
          <button className="rounded bg-zinc-900 px-3 py-1.5 text-white">Record</button>
        </form>
        {group.payments.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-zinc-500">
            {group.payments.map((p) => (
              <li key={p.id}>
                {nameOf.get(p.fromUserId)} paid {nameOf.get(p.toUserId)}{" "}
                <span className="tabular-nums">{formatUSD(p.amount)}</span>{" "}
                · {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Add member</h2>
        <form action={addMember} className="flex gap-2">
          <input type="hidden" name="groupId" value={group.id} />
          <input name="email" type="email" placeholder="friend@example.com" required
            className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button className="rounded border border-zinc-300 px-3 py-2 text-sm">Add</button>
        </form>
      </section>
    </main>
  );
}
