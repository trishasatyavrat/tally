// CSV import: upload a bank export, get a summary of what happened.
//
// The page is a Server Component; the form posts to a Server Action
// that redirects back here with the result in the query string. No
// client-side state, no JavaScript needed for the round trip.
import Link from "next/link";
import { Nav } from "@/components/nav";
import { importCsv } from "./actions";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const problems = ([] as string[]).concat(sp.problem ?? []);
  const error = one("error");
  const added = one("added");

  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      <Nav current="/import" />
      <h1 className="mb-1 text-2xl font-semibold">Import a bank CSV</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Export transactions from your bank as CSV and upload the file. Spend
        is imported; deposits and payments are skipped; rows you have already
        imported are ignored.
      </p>

      <form action={importCsv} className="mb-8 flex flex-wrap items-center gap-3">
        <input
          type="file" name="file" accept=".csv,text/csv" required
          className="text-sm file:mr-3 file:rounded file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
        />
        <button className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Import</button>
      </form>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {added !== undefined && (
        <section className="rounded border border-zinc-200 p-4 text-sm">
          <p className="font-medium">
            Imported {added} expense{added === "1" ? "" : "s"}.
          </p>
          <ul className="mt-2 space-y-1 text-zinc-600">
            <li>{one("ruled")} categorized from merchants you have labeled before</li>
            <li>{one("duplicates")} already imported (skipped)</li>
            <li>{one("credits")} deposits / payments (skipped)</li>
            <li>{one("unparsed")} rows could not be read</li>
          </ul>
          {problems.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-zinc-500">Unreadable rows</summary>
              <ul className="mt-1 font-mono text-xs text-zinc-500">
                {problems.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </details>
          )}
          <p className="mt-3">
            <Link href="/" className="underline">Back to the dashboard</Link> to categorize them.
          </p>
        </section>
      )}

      <section className="mt-10 text-xs text-zinc-500">
        <p className="mb-1 font-medium text-zinc-600">Recognized layouts</p>
        <p>
          A header row with a date column (Transaction Date, Post Date, Date),
          a description column (Description, Payee, Merchant, Memo), and
          either an Amount column (negative = spend) or Debit / Credit
          columns. Dates as 2026-09-03, 09/03/2026, or 9/3/26.
        </p>
      </section>
    </main>
  );
}
