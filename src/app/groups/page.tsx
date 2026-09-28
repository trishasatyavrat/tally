import Link from "next/link";
import { db } from "@/lib/db";
import { Nav } from "@/components/nav";
import { getOrCreateDemoUser } from "@/app/actions";
import { createGroup } from "./actions";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const me = await getOrCreateDemoUser();
  const groups = await db.group.findMany({
    where: { members: { some: { userId: me.id } } },
    include: { members: { include: { user: true } }, _count: { select: { expenses: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      <Nav current="/groups" />
      <h1 className="mb-6 text-2xl font-semibold">Groups</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">New group</h2>
        <form action={createGroup} className="flex flex-wrap gap-2">
          <input name="name" placeholder="Apartment 4B" required
            className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input name="emails" placeholder="friend@example.com, other@example.com"
            className="min-w-64 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Create</button>
        </form>
        <p className="mt-1 text-xs text-zinc-500">You are added automatically.</p>
      </section>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">No groups yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-sm">
          {groups.map((g) => (
            <li key={g.id} className="flex items-baseline justify-between py-3">
              <Link href={`/groups/${g.id}`} className="font-medium underline">{g.name}</Link>
              <span className="text-xs text-zinc-500">
                {g.members.map((m) => m.user.name).join(", ")} · {g._count.expenses} expenses
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
