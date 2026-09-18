// Merchant memory: "you filed Chipotle under Food last time, so this
// Chipotle is Food too."
//
// No rules table. The rule *is* the history: every expense the user
// categorized by hand is evidence, and a normalized merchant key ties
// visits together. Store facts, compute conclusions (see LEARNING.md,
// Day 1) - and a table of rules would drift from the expenses that
// justify them.
import { db } from "@/lib/db";
import { normalizeMerchant } from "@/lib/merchant";

export type LabeledRow = { merchant: string | null; description: string; categoryId: string | null };

/**
 * From labeled history, the category each merchant key maps to.
 * Majority vote per key; ties go to the most recent (rows are expected
 * newest-first). Pure, so it is tested without a database.
 */
export function buildRuleMap(history: LabeledRow[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  const firstSeen = new Map<string, string>(); // key -> most recent category
  for (const row of history) {
    if (!row.categoryId) continue;
    const key = normalizeMerchant(row.merchant ?? row.description);
    if (!key) continue;
    if (!firstSeen.has(key)) firstSeen.set(key, row.categoryId);
    const v = votes.get(key) ?? new Map<string, number>();
    v.set(row.categoryId, (v.get(row.categoryId) ?? 0) + 1);
    votes.set(key, v);
  }
  const rules = new Map<string, string>();
  for (const [key, v] of votes) {
    let best = firstSeen.get(key)!;
    let bestN = v.get(best) ?? 0;
    for (const [cat, n] of v) if (n > bestN) { best = cat; bestN = n; }
    rules.set(key, best);
  }
  return rules;
}

export async function loadRules(userId: string): Promise<Map<string, string>> {
  // Only learn from the user's own hand-labeled rows. Learning from
  // RULE- or AI-labeled rows would let one wrong guess reinforce itself
  // forever; a human label is the only thing that should teach the rule.
  const history = await db.expense.findMany({
    where: { userId, categoryId: { not: null }, categorySource: "MANUAL" },
    select: { merchant: true, description: true, categoryId: true },
    orderBy: { date: "desc" },
    take: 5000,
  });
  return buildRuleMap(history);
}

export type RuleResult = { categorized: number; remaining: number };

/** Categorize every uncategorized expense whose merchant the history knows. */
export async function categorizeByRules(userId: string): Promise<RuleResult> {
  const rules = await loadRules(userId);
  const pending = await db.expense.findMany({
    where: { userId, categoryId: null },
    select: { id: true, merchant: true, description: true },
  });
  let categorized = 0;
  // Group by target category so it is one UPDATE per category, not per row.
  const byCategory = new Map<string, string[]>();
  for (const e of pending) {
    const cat = rules.get(normalizeMerchant(e.merchant ?? e.description));
    if (!cat) continue;
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), e.id]);
    categorized++;
  }
  await db.$transaction(
    [...byCategory].map(([categoryId, ids]) =>
      db.expense.updateMany({ where: { id: { in: ids } }, data: { categoryId, categorySource: "RULE" } })
    )
  );
  return { categorized, remaining: pending.length - categorized };
}
