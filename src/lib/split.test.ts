import { describe, it, expect } from "vitest";
import { equalSplitCents, decimalStringToCents, transfersFromSplitRows } from "./split";

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
