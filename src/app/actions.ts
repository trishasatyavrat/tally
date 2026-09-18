"use server";

// Server Actions: functions that run on the server but are called
// directly from a form in the browser. Next.js handles the network
// round-trip, so there is no hand-written API route or fetch() here -
// but the code still executes server-side, which is why it can touch
// the database and why validation must happen here rather than only in
// the UI (a client can always be bypassed).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentMonth } from "@/lib/dates";
import { categorizeByRules } from "@/lib/categorize/rules";

// A demo user so the app is usable before auth exists. Auth replaces
// this with the signed-in user's id; nothing else changes.
export async function getOrCreateDemoUser() {
  return db.user.upsert({
    where: { email: "demo@tally.local" },
    update: {},
    create: { email: "demo@tally.local", name: "Demo" },
  });
}

export async function addExpense(formData: FormData) {
  const user = await getOrCreateDemoUser();

  const rawAmount = String(formData.get("amount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  // Server-side validation. The amount stays a string all the way into
  // Prisma so it lands in the Decimal column without ever becoming a
  // float - parsing it here would reintroduce the rounding error the
  // schema was designed to avoid.
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
    throw new Error("Amount must be a positive number with at most 2 decimals");
  }
  if (!description) throw new Error("Description is required");

  await db.expense.create({
    data: {
      amount: rawAmount,
      description,
      merchant: description,
      userId: user.id,
      categoryId: categoryId || null,
      categorySource: "MANUAL",
    },
  });

  // Tell Next.js the cached page is stale so the new row shows up.
  revalidatePath("/");
}

export async function setBudget(formData: FormData) {
  const user = await getOrCreateDemoUser();
  const categoryId = String(formData.get("categoryId") ?? "");
  const rawCap = String(formData.get("capAmount") ?? "").trim();
  const month = currentMonth();

  if (!/^\d+(\.\d{1,2})?$/.test(rawCap)) throw new Error("Invalid cap amount");

  await db.budget.upsert({
    where: { userId_categoryId_month: { userId: user.id, categoryId, month } },
    update: { capAmount: rawCap },
    create: { userId: user.id, categoryId, month, capAmount: rawCap },
  });

  revalidatePath("/");
}

// Change (or set) the category on an existing expense. Marked MANUAL:
// this is a human label, the only kind merchant rules learn from.
export async function setCategory(formData: FormData) {
  const user = await getOrCreateDemoUser();
  const expenseId = String(formData.get("expenseId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!expenseId) throw new Error("Missing expense");

  // updateMany with the userId in the filter, not update by id alone:
  // a client can send any id, and ownership must be enforced server-side.
  await db.expense.updateMany({
    where: { id: expenseId, userId: user.id },
    data: { categoryId: categoryId || null, categorySource: "MANUAL" },
  });
  revalidatePath("/");
}

// Apply merchant memory to everything still uncategorized.
export async function applyRules() {
  const user = await getOrCreateDemoUser();
  await categorizeByRules(user.id);
  revalidatePath("/");
}
