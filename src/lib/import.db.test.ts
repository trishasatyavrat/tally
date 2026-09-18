// Integration test: real Postgres, real Prisma. Skipped when there is
// no DATABASE_URL (unit tests must never need a database to run).
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { importRows } from "./import";
import { fingerprint } from "./csv";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("importRows (database)", () => {
  const stamp = `import-test-${Date.now()}`;
  const day = new Date(2026, 8, 3);
  const rows = [
    { date: day, description: `${stamp} A`, amountCents: 1240, fingerprint: fingerprint(day, 1240, `${stamp} A`) },
    { date: day, description: `${stamp} B`, amountCents: 5, fingerprint: fingerprint(day, 5, `${stamp} B`) },
  ];
  let userId = "";

  afterAll(async () => {
    await db.expense.deleteMany({ where: { fingerprint: { in: rows.map((r) => r.fingerprint) } } });
  });

  it("inserts new rows, stores exact amounts, and ignores re-imports", async () => {
    const user = await db.user.upsert({
      where: { email: "demo@tally.local" }, update: {}, create: { email: "demo@tally.local", name: "Demo" },
    });
    userId = user.id;

    expect(await importRows(userId, rows)).toEqual({ added: 2, duplicates: 0 });
    // Same file again: nothing new. Overlapping export: only the new row.
    expect(await importRows(userId, rows)).toEqual({ added: 0, duplicates: 2 });

    const stored = await db.expense.findMany({ where: { fingerprint: { in: rows.map((r) => r.fingerprint) } }, orderBy: { description: "asc" } });
    expect(stored.map((e) => e.amount.toString())).toEqual(["12.4", "0.05"]);
    expect(stored.every((e) => e.categoryId === null && e.merchant === e.description)).toBe(true);
  });

  it("returns zeros for an empty import", async () => {
    expect(await importRows(userId, [])).toEqual({ added: 0, duplicates: 0 });
  });
});
