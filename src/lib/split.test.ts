import { describe, it, expect } from "vitest";
import { equalSplitCents, decimalStringToCents, transfersFromSplitRows, paymentsAsSplits, myShareCents } from "./split";
import { netBalances } from "./settle";

describe("equalSplitCents", () => {
  it("hands out remainder cents so shares always sum to the total", () => {
    expect(equalSplitCents(1000, 3)).toEqual([334, 333, 333]);
    expect(equalSplitCents(1000, 4)).toEqual([250, 250, 250, 250]);
    expect(equalSplitCents(1, 2)).toEqual([1, 0]);
    expect(equalSplitCents(0, 3)).toEqual([0, 0, 0]);
    for (let total = 0; total < 500; total += 7)
      for (let n = 1; n <= 6; n++)
        expect(equalSplitCents(total, n).reduce((a, b) => a + b, 0)).toBe(total);
  });
  it("rejects nonsense", () => {
    expect(() => equalSplitCents(100, 0)).toThrow();
    expect(() => equalSplitCents(10.5, 2)).toThrow();
  });
});

describe("decimalStringToCents", () => {
  it("parses Prisma's Decimal strings exactly", () => {
    expect(decimalStringToCents("12.34")).toBe(1234);
    expect(decimalStringToCents("12.4")).toBe(1240);
    expect(decimalStringToCents("7")).toBe(700);
    expect(decimalStringToCents("-0.05")).toBe(-5);
    expect(() => decimalStringToCents("1.234")).toThrow();
  });
});

describe("transfersFromSplitRows", () => {
  it("nets unsettled splits into payments and ignores settled ones", () => {
    // A paid 30, split 3 ways: B and C owe A 10 each. B paid 10 for A.
    const rows = [
      { amount: "10.00", owedById: "B", settled: false, expense: { userId: "A" } },
      { amount: "10.00", owedById: "C", settled: false, expense: { userId: "A" } },
      { amount: "10.00", owedById: "A", settled: false, expense: { userId: "B" } },
      { amount: "99.00", owedById: "C", settled: true, expense: { userId: "A" } },
    ];
    expect(transfersFromSplitRows(rows)).toEqual([{ fromUserId: "C", toUserId: "A", amountCents: 1000 }]);
  });
});

describe("payments", () => {
  const dinner = [ // A paid $30 for three: B and C owe A $10 each
    { amount: "10.00", owedById: "B", settled: false, expense: { userId: "A" } },
    { amount: "10.00", owedById: "C", settled: false, expense: { userId: "A" } },
  ];

  it("a full payment clears exactly that debt", () => {
    const t = transfersFromSplitRows(dinner, [{ amount: "10.00", fromUserId: "B", toUserId: "A" }]);
    expect(t).toEqual([{ fromUserId: "C", toUserId: "A", amountCents: 1000 }]);
  });

  it("a partial payment leaves the remainder", () => {
    const t = transfersFromSplitRows(dinner, [{ amount: "4.50", fromUserId: "C", toUserId: "A" }]);
    expect(t).toContainEqual({ fromUserId: "C", toUserId: "A", amountCents: 550 });
    expect(t).toContainEqual({ fromUserId: "B", toUserId: "A", amountCents: 1000 });
  });

  it("paying everything brings every balance to zero", () => {
    const pays = [
      { amount: "10.00", fromUserId: "B", toUserId: "A" },
      { amount: "10.00", fromUserId: "C", toUserId: "A" },
    ];
    expect(transfersFromSplitRows(dinner, pays)).toEqual([]);
  });

  it("an overpayment flips the direction instead of disappearing", () => {
    const t = transfersFromSplitRows(dinner.slice(0, 1), [{ amount: "15.00", fromUserId: "B", toUserId: "A" }]);
    expect(t).toEqual([{ fromUserId: "A", toUserId: "B", amountCents: 500 }]);
  });

  it("maps a payment to a split in the paying direction", () => {
    expect(paymentsAsSplits([{ amount: "2.00", fromUserId: "X", toUserId: "Y" }]))
      .toEqual([{ paidByUserId: "X", owedByUserId: "Y", amountCents: 200 }]);
    expect(netBalances(paymentsAsSplits([{ amount: "2.00", fromUserId: "X", toUserId: "Y" }])))
      .toEqual([{ userId: "X", amountCents: 200 }, { userId: "Y", amountCents: -200 }]);
  });
});

describe("myShareCents", () => {
  // $10.00 split three ways, paid by A: B and C owe 333 each, A's share is 334.
  const e = { userId: "A", amount: "10.00", splits: [
    { owedById: "B", amount: "3.33" }, { owedById: "C", amount: "3.33" }] };
  it("payer's share is the total minus what others owe", () => {
    expect(myShareCents(e, "A")).toBe(334);
  });
  it("a participant's share is their split", () => {
    expect(myShareCents(e, "B")).toBe(333);
  });
  it("shares always add up to the total", () => {
    expect(["A", "B", "C"].reduce((s, u) => s + myShareCents(e, u), 0)).toBe(1000);
  });
  it("someone outside the split has no share", () => {
    expect(myShareCents(e, "D")).toBe(0);
  });
});
