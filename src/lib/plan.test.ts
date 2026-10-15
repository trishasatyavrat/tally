import { describe, it, expect } from "vitest";
import { previousMonths, median, suggestCap } from "./plan";

describe("previousMonths", () => {
  it("walks back across a year boundary, oldest first", () => {
    expect(previousMonths("2026-10", 3)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(previousMonths("2027-02", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("median", () => {
  it("handles odd and even lengths without mutating input", () => {
    const xs = [300, 100, 200];
    expect(median(xs)).toBe(200);
    expect(xs).toEqual([300, 100, 200]);
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(() => median([])).toThrow();
  });
});

describe("suggestCap", () => {
  it("uses the median, rounded up to $5", () => {
    // Delivery: $112.40, $131.10, $98.00 -> median $112.40 -> cap $115.
    const s = suggestCap([11240, 13110, 9800]);
    expect(s.suggestedCapCents).toBe(11500);
  });

  it("ignores a one-off spike that a mean would chase", () => {
    // Fun: $40, $310 (concert), $45 -> median $45 -> $45, not mean $131.67.
    expect(suggestCap([4000, 31000, 4500]).suggestedCapCents).toBe(4500);
  });

  it("refuses to guess from less than two months of spend", () => {
    expect(suggestCap([0, 0, 5000])).toMatchObject({ suggestedCapCents: null, trend: "new" });
    expect(suggestCap([0, 0, 0]).suggestedCapCents).toBeNull();
  });

  it("calls a trend only outside a 15% dead band", () => {
    expect(suggestCap([10000, 10000, 12000]).trend).toBe("rising");
    expect(suggestCap([10000, 10000, 11000]).trend).toBe("flat");
    expect(suggestCap([10000, 10000, 8000]).trend).toBe("falling");
  });
});
