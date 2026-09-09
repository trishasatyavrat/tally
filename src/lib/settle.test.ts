import { describe, it, expect } from "vitest";
import { netBalances, settleUp, settleFromSplits, type Balance } from "./settle";

// Helper: does this set of transfers actually zero every balance?
// This is the property that matters - far more than any specific
// sequence of payments, which the algorithm is free to choose.
function appliedBalances(balances: Balance[], transfers: ReturnType<typeof settleUp>) {
  const net = new Map(balances.map((b) => [b.userId, b.amountCents]));
  for (const t of transfers) {
    net.set(t.fromUserId, (net.get(t.fromUserId) ?? 0) + t.amountCents);
    net.set(t.toUserId, (net.get(t.toUserId) ?? 0) - t.amountCents);
  }
  return [...net.values()];
}

describe("netBalances", () => {
  it("nets offsetting debts to zero", () => {
    // A paid $20 for B, then B paid $20 for A. Nobody owes anybody.
    const out = netBalances([
      { paidByUserId: "A", owedByUserId: "B", amountCents: 2000 },
      { paidByUserId: "B", owedByUserId: "A", amountCents: 2000 },
    ]);
    expect(out).toEqual([]);
  });

  it("ignores self-owed splits", () => {
    expect(netBalances([{ paidByUserId: "A", owedByUserId: "A", amountCents: 500 }]))
      .toEqual([]);
  });

  it("sums multiple splits per person", () => {
    const out = netBalances([
      { paidByUserId: "A", owedByUserId: "B", amountCents: 1000 },
      { paidByUserId: "A", owedByUserId: "C", amountCents: 1500 },
    ]);
    expect(out.find((b) => b.userId === "A")?.amountCents).toBe(2500);
    expect(out.find((b) => b.userId === "B")?.amountCents).toBe(-1000);
  });
});

describe("settleUp", () => {
  it("handles the simple two-person case", () => {
    const transfers = settleUp([
      { userId: "A", amountCents: -1500 },
      { userId: "B", amountCents: 1500 },
    ]);
    expect(transfers).toEqual([{ fromUserId: "A", toUserId: "B", amountCents: 1500 }]);
  });

  it("collapses a circular debt through the middle person", () => {
    // A owes B 20, B owes C 20 -> B is net flat, so A should pay C
    // directly. One transfer instead of two.
    const transfers = settleFromSplits([
      { paidByUserId: "B", owedByUserId: "A", amountCents: 2000 },
      { paidByUserId: "C", owedByUserId: "B", amountCents: 2000 },
    ]);
    expect(transfers).toEqual([{ fromUserId: "A", toUserId: "C", amountCents: 2000 }]);
  });

  it("never needs more than n-1 transfers", () => {
    const balances: Balance[] = [
      { userId: "A", amountCents: -5000 },
      { userId: "B", amountCents: -3000 },
      { userId: "C", amountCents: 6000 },
      { userId: "D", amountCents: 2000 },
    ];
    const transfers = settleUp(balances);
    expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
    expect(appliedBalances(balances, transfers).every((v) => v === 0)).toBe(true);
  });

  it("returns nothing when everyone is square", () => {
    expect(settleUp([])).toEqual([]);
  });

  it("settles every balance across 200 random groups", () => {
    // Property test: whatever the algorithm chooses, applying the
    // transfers must leave everyone at zero, and it must never emit
    // more than n-1 of them.
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(rand() * 8);
      const balances: Balance[] = [];
      let running = 0;
      for (let i = 0; i < n - 1; i++) {
        const amt = Math.floor((rand() - 0.5) * 20000);
        balances.push({ userId: `u${i}`, amountCents: amt });
        running += amt;
      }
      // Last person absorbs the remainder so the group sums to zero -
      // an invariant of real expense data: every dollar someone is
      // owed is a dollar someone else owes.
      balances.push({ userId: `u${n - 1}`, amountCents: -running });

      const nonZero = balances.filter((b) => b.amountCents !== 0);
      const transfers = settleUp(nonZero);
      expect(appliedBalances(nonZero, transfers).every((v) => v === 0)).toBe(true);
      if (nonZero.length > 0) {
        expect(transfers.length).toBeLessThanOrEqual(nonZero.length - 1);
      }
    }
  });
});
