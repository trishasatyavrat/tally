"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseBankCsv } from "@/lib/csv";
import { importRows } from "@/lib/import";
import { categorizeByRules } from "@/lib/categorize/rules";
import { getOrCreateDemoUser } from "@/app/actions";

const MAX_BYTES = 2 * 1024 * 1024; // a year of transactions is well under this

export async function importCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/import?error=" + encodeURIComponent("Choose a CSV file"));
  if (file.size > MAX_BYTES) redirect("/import?error=" + encodeURIComponent("File is larger than 2 MB"));

  const parsed = parseBankCsv(await file.text());
  if ("error" in parsed) redirect("/import?error=" + encodeURIComponent(parsed.error));

  const user = await getOrCreateDemoUser();
  const { added, duplicates } = await importRows(user.id, parsed.rows);
  // Merchant memory runs right after import, so anything seen before
  // arrives already categorized.
  const rules = await categorizeByRules(user.id);
  revalidatePath("/");

  const q = new URLSearchParams({
    added: String(added), duplicates: String(duplicates),
    ruled: String(rules.categorized),
    credits: String(parsed.credits), unparsed: String(parsed.unparsed),
  });
  for (const p of parsed.problems) q.append("problem", p);
  redirect(`/import?${q}`);
}
