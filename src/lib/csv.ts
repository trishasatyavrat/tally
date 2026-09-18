// Bank CSV import: text in, clean expense rows out.
//
// Every bank exports a slightly different CSV - column names, date
// formats, whether debits are negative numbers or live in their own
// column. This module handles the common shapes and refuses loudly
// on anything it cannot read, so a bad file never silently imports
// garbage. It is pure (no database, no Next.js) so it can be tested
// against pasted samples in milliseconds.
import { createHash } from "node:crypto";

export type ImportedRow = {
  date: Date;
  description: string;
  amountCents: number; // always positive: this is spend
  fingerprint: string;
};

export type ParseResult = {
  rows: ImportedRow[];
  credits: number; // deposits/refunds skipped (positive amounts)
  unparsed: number; // rows we could not read
  problems: string[]; // first few unparsed rows, for the UI
};

/** RFC 4180 parsing: quoted fields, doubled quotes, CRLF, blank lines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM, which Excel exports love to prepend.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Column detection by header name. Order within each list is priority.
const DATE_HEADERS = ["transaction date", "trans date", "posted date", "post date", "date"];
const DESC_HEADERS = ["description", "merchant", "payee", "name", "memo", "details"];
const AMOUNT_HEADERS = ["amount", "transaction amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "money out"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "money in"];

type Columns = { date: number; desc: number; amount?: number; debit?: number; credit?: number };

function findColumn(headers: string[], candidates: string[]): number | undefined {
  for (const c of candidates) {
    const i = headers.indexOf(c);
    if (i !== -1) return i;
  }
  return undefined;
}

export function detectColumns(headerRow: string[]): Columns | null {
  const headers = headerRow.map((h) => h.trim().toLowerCase());
  const date = findColumn(headers, DATE_HEADERS);
  const desc = findColumn(headers, DESC_HEADERS);
  const amount = findColumn(headers, AMOUNT_HEADERS);
  const debit = findColumn(headers, DEBIT_HEADERS);
  const credit = findColumn(headers, CREDIT_HEADERS);
  if (date === undefined || desc === undefined) return null;
  if (amount === undefined && debit === undefined) return null;
  return { date, desc, amount, debit, credit };
}

/** "12.34", "-12.34", "$1,234.56", "(12.34)" -> cents, or null. */
export function parseAmountCents(raw: string): number | null {
  let s = raw.trim();
  if (s === "") return null;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = !negative; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  // String arithmetic: never let the amount touch a float.
  const [whole, frac = ""] = s.split(".");
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return negative ? -cents : cents;
}

/** YYYY-MM-DD, MM/DD/YYYY, M/D/YY, "Sep 3, 2026" -> Date (local midnight), or null. */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    [m, d, y] = [+match[1], +match[2], +match[3]];
    if (y < 100) y += 2000;
  } else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 ? date : null; // rejects Feb 30
}

/**
 * Stable identity for a transaction: same date + amount + description
 * = same transaction. Re-importing an overlapping export must not
 * duplicate rows, and banks give no reliable transaction id in CSV.
 */
export function fingerprint(date: Date, amountCents: number, description: string): string {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const key = `${day}|${amountCents}|${description.trim().toLowerCase().replace(/\s+/g, " ")}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function parseBankCsv(text: string): ParseResult | { error: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { error: "File has no data rows" };
  const cols = detectColumns(table[0]);
  if (!cols) {
    return { error: `Could not find date, description and amount columns in header: ${table[0].join(", ")}` };
  }

  const result: ParseResult = { rows: [], credits: 0, unparsed: 0, problems: [] };
  for (const row of table.slice(1)) {
    const date = parseDate(row[cols.date] ?? "");
    const description = (row[cols.desc] ?? "").trim();

    // Sign convention: an expense is money leaving the account. In a
    // single Amount column banks show that as negative; with separate
    // Debit/Credit columns it is whatever is in Debit.
    let spendCents: number | null = null;
    let isCredit = false;
    if (cols.amount !== undefined) {
      const a = parseAmountCents(row[cols.amount] ?? "");
      if (a === null) spendCents = null;
      else if (a < 0) spendCents = -a;
      else if (a === 0) spendCents = 0;
      else isCredit = true;
    } else {
      const debit = parseAmountCents(row[cols.debit!] ?? "");
      const credit = cols.credit !== undefined ? parseAmountCents(row[cols.credit] ?? "") : null;
      if (debit !== null && debit !== 0) spendCents = Math.abs(debit);
      else if (credit !== null && credit !== 0) isCredit = true;
      else spendCents = null;
    }

    if (isCredit) { result.credits++; continue; }
    if (!date || !description || spendCents === null || spendCents === 0) {
      result.unparsed++;
      if (result.problems.length < 5) result.problems.push(row.join(", "));
      continue;
    }
    result.rows.push({
      date, description, amountCents: spendCents,
      fingerprint: fingerprint(date, spendCents, description),
    });
  }
  return result;
}

/** 1234 -> "12.34": the string Prisma's Decimal column wants. */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
