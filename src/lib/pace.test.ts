import { describe, it, expect } from "vitest";
import { computePace, daysInMonth } from "./pace";

describe("daysInMonth", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe("computePace", () => {
  it("projects linearly and gives a daily allowance", () => {
    // $60 of a $150 delivery cap by Oct 10 -> on pace for $186.
    const p = computePace(6000, 15000, 10, 31);
    expect(p.projectedCents).toBe(18600);
    expect(p.remainingCents).toBe(9000);
    expect(p.dailyAllowanceCents).toBe(409); // $90 over 22 days incl. today
    expect(p.status).toBe("over-pace");
  });

  it("says on-track when the projection is under 90% of the cap", () => {
    expect(computePace(3000, 15000, 15, 30).status).toBe("on-track"); // projects $60
  });

  it("says watch between 90% and 100% of the cap", () => {
    expect(computePace(7000, 15000, 15, 30).status).toBe("watch"); // projects $140
  });

  it("does not forecast over-pace in the first four days", () => {
    expect(computePace(4000, 15000, 2, 30).status).toBe("on-track"); // projects $600
    expect(computePace(4000, 15000, 5, 30).status).toBe("over-pace");
  });

  it("over-cap is a fact and overrides everything, from day one", () => {
    const p = computePace(16000, 15000, 1, 30);
    expect(p.status).toBe("over-cap");
    expect(p.remainingCents).toBe(-1000);
    expect(p.dailyAllowanceCents).toBe(0);
  });

  it("handles no cap, zero spend, and the last day", () => {
    expect(computePace(5000, null, 10, 30).status).toBe("no-cap");
    expect(computePace(0, 15000, 20, 30)).toMatchObject({ projectedCents: 0, status: "on-track" });
    expect(computePace(14000, 15000, 30, 30).dailyAllowanceCents).toBe(1000);
  });

  it("rejects impossible days", () => {
    expect(() => computePace(0, 100, 0, 30)).toThrow();
    expect(() => computePace(0, 100, 31, 30)).toThrow();
  });
});
