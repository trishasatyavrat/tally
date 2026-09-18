import { describe, it, expect } from "vitest";
import {
  parseCsv, detectColumns, parseAmountCents, parseDate, fingerprint,
  parseBankCsv, centsToDecimalString,
} from "./csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas in fields, CRLF, BOM", () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""",3\r\n\r\n1,2,3\n';
    expect(parseCsv(text)).toEqual([["a", "b", "c"], ["x, y", 'say "hi"', "3"], ["1", "2", "3"]]);
  });
  it("keeps empty fields positionally", () => {
    expect(parseCsv("a,,c\n,2,")).toEqual([["a", "", "c"], ["", "2", ""]]);
  });
});

describe("parseAmountCents", () => {
  it("reads every common money spelling without floats", () => {
    expect(parseAmountCents("12.34")).toBe(1234);
    expect(parseAmountCents("-12.34")).toBe(-1234);
    expect(parseAmountCents("$1,234.56")).toBe(123456);
    expect(parseAmountCents("(12.34)")).toBe(-1234);
    expect(parseAmountCents("7")).toBe(700);
    expect(parseAmountCents("0.1")).toBe(10);
    expect(parseAmountCents("")).toBeNull();
    expect(parseAmountCents("abc")).toBeNull();
    expect(parseAmountCents("1.234")).toBeNull(); // 3 decimals is not money
  });
});

describe("parseDate", () => {
  it("reads ISO, US, two-digit-year, and long formats", () => {
    expect(parseDate("2026-09-03")).toEqual(new Date(2026, 8, 3));
    expect(parseDate("09/03/2026")).toEqual(new Date(2026, 8, 3));
    expect(parseDate("9/3/26")).toEqual(new Date(2026, 8, 3));
    expect(parseDate("Sep 3, 2026")).toEqual(new Date(2026, 8, 3));
    expect(parseDate("2026-09-03T14:00:00Z")).toEqual(new Date(2026, 8, 3));
  });
  it("rejects impossible dates instead of rolling them over", () => {
    expect(parseDate("02/30/2026")).toBeNull();
    expect(parseDate("13/01/2026")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("detectColumns", () => {
  it("finds columns by name, case-insensitively, preferring transaction date", () => {
    const cols = detectColumns(["Transaction Date", "Post Date", "Description", "Category", "Type", "Amount", "Memo"]);
    expect(cols).toEqual({ date: 0, desc: 2, amount: 5, debit: undefined, credit: undefined });
  });
  it("supports debit/credit layouts and rejects unusable headers", () => {
    expect(detectColumns(["Date", "Payee", "Debit", "Credit"])).toEqual({ date: 0, desc: 1, amount: undefined, debit: 2, credit: 3 });
    expect(detectColumns(["Foo", "Bar"])).toBeNull();
    expect(detectColumns(["Date", "Description"])).toBeNull();
  });
});

describe("parseBankCsv", () => {
  const chase = [
    "Transaction Date,Post Date,Description,Category,Type,Amount,Memo",
    "09/03/2026,09/04/2026,CHIPOTLE 0231,Food & Drink,Sale,-12.40,",
    '09/02/2026,09/03/2026,"AMZN Mktp US*2K3, Seattle",Shopping,Sale,-23.99,',
    "09/01/2026,09/02/2026,Payment Thank You,,Payment,250.00,",
    "09/01/2026,09/02/2026,,,Sale,-5.00,",
  ].join("\n");

  it("imports spend, skips credits, counts unparsable rows", () => {
    const r = parseBankCsv(chase);
    if ("error" in r) throw new Error(r.error);
    expect(r.rows.map((x) => [x.description, x.amountCents])).toEqual([
      ["CHIPOTLE 0231", 1240], ["AMZN Mktp US*2K3, Seattle", 2399],
    ]);
    expect(r.credits).toBe(1);
    expect(r.unparsed).toBe(1);
    expect(r.problems).toHaveLength(1);
    expect(r.rows[0].date).toEqual(new Date(2026, 8, 3));
  });

  it("reads debit/credit column layouts", () => {
    const r = parseBankCsv("Date,Payee,Debit,Credit\n2026-09-05,Trader Joe's,45.10,\n2026-09-06,Paycheck,,1200.00\n");
    if ("error" in r) throw new Error(r.error);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].amountCents).toBe(4510);
    expect(r.credits).toBe(1);
  });

  it("reports an error for an unrecognized header or empty file", () => {
    expect(parseBankCsv("x,y\n1,2")).toEqual({ error: expect.stringContaining("Could not find") });
    expect(parseBankCsv("Date,Description,Amount")).toEqual({ error: "File has no data rows" });
  });

  it("gives identical fingerprints to the same transaction across exports", () => {
    const a = fingerprint(new Date(2026, 8, 3), 1240, "CHIPOTLE 0231");
    const b = fingerprint(new Date(2026, 8, 3), 1240, "  chipotle   0231 ");
    const c = fingerprint(new Date(2026, 8, 3), 1241, "CHIPOTLE 0231");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(32);
  });
});

describe("centsToDecimalString", () => {
  it("formats cents for the Decimal column", () => {
    expect(centsToDecimalString(1234)).toBe("12.34");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(100)).toBe("1.00");
    expect(centsToDecimalString(-250)).toBe("-2.50");
  });
});
