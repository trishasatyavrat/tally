// Turning parsed CSV rows into Expense records. Separate from the
// server action so it can be exercised from a script or test without
// Next.js, and so the action stays a thin adapter (read the file,
// call this, redirect).
import { db } from "@/lib/db";
import { centsToDecimalString, type ImportedRow } from "@/lib/csv";

export type ImportSummary = { added: number; duplicates: number };

export async function importRows(userId: string, rows: ImportedRow[]): Promise<ImportSummary> {
  if (rows.length === 0) return { added: 0, duplicates: 0 };

  // Two exports from the same bank overlap by weeks. The unique
  // fingerprint plus skipDuplicates makes re-import a no-op for rows we
  // already have - one INSERT ... ON CONFLICT DO NOTHING, not N lookups.
  const result = await db.expense.createMany({
    data: rows.map((r) => ({
      userId,
      amount: centsToDecimalString(r.amountCents),
      description: r.description,
      merchant: r.description,
      date: r.date,
      fingerprint: r.fingerprint,
      categorySource: "MANUAL" as const, // no category yet; rules/AI come next
    })),
    skipDuplicates: true,
  });
  return { added: result.count, duplicates: rows.length - result.count };
}
