"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseBankCsv } from "@/lib/csv";
import { importRows } from "@/lib/import";
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
  revalidatePath("/");

  const q = new URLSearchParams({
    added: String(added), duplicates: String(duplicates),
    credits: String(parsed.credits), unparsed: String(parsed.unparsed),
  });
  for (const p of parsed.problems) q.append("problem", p);
  redirect(`/import?${q}`);
}
