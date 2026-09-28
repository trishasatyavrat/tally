"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { equalSplitCents } from "@/lib/split";
import { centsToDecimalString, parseAmountCents } from "@/lib/csv";
import { getOrCreateDemoUser } from "@/app/actions";

// Members are Users, found or created by email. Until auth exists a
// member is just an email + a display name derived from it.
async function findOrCreateUserByEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error(`Not an email: ${email}`);
  return db.user.upsert({ where: { email: e }, update: {}, create: { email: e, name: e.split("@")[0] } });
}

async function requireMembership(groupId: string, userId: string) {
  const m = await db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
  if (!m) throw new Error("Not a member of this group");
}

export async function createGroup(formData: FormData) {
  const me = await getOrCreateDemoUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Group needs a name");
  const emails = String(formData.get("emails") ?? "").split(/[\s,;]+/).filter(Boolean);
  const members = await Promise.all(emails.map(findOrCreateUserByEmail));
  const ids = [...new Set([me.id, ...members.map((m) => m.id)])];

  const group = await db.group.create({
    data: { name, members: { create: ids.map((userId) => ({ userId })) } },
  });
  redirect(`/groups/${group.id}`);
}

export async function addMember(formData: FormData) {
  const me = await getOrCreateDemoUser();
  const groupId = String(formData.get("groupId") ?? "");
  await requireMembership(groupId, me.id);
  const user = await findOrCreateUserByEmail(String(formData.get("email") ?? ""));
  await db.groupMember.upsert({
    where: { userId_groupId: { userId: user.id, groupId } }, update: {}, create: { userId: user.id, groupId },
  });
  revalidatePath(`/groups/${groupId}`);
}

// A shared expense: one payer, an equal split among the chosen
// participants. The payer's own share is not a debt, so Split rows are
// created only for the others. Everything is one transaction: an
// expense without its splits would be a phantom debt-free purchase.
export async function addSharedExpense(formData: FormData) {
  const me = await getOrCreateDemoUser();
  const groupId = String(formData.get("groupId") ?? "");
  await requireMembership(groupId, me.id);

  const description = String(formData.get("description") ?? "").trim();
  const cents = parseAmountCents(String(formData.get("amount") ?? ""));
  const paidById = String(formData.get("paidById") ?? "");
  const participants = formData.getAll("participants").map(String);
  if (!description) throw new Error("Description is required");
  if (cents === null || cents <= 0) throw new Error("Amount must be positive");
  if (participants.length === 0) throw new Error("Pick at least one participant");

  // Only group members may pay or participate - the form is not trusted.
  const members = await db.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberIds = new Set(members.map((m) => m.userId));
  if (!memberIds.has(paidById) || participants.some((p) => !memberIds.has(p)))
    throw new Error("Payer and participants must be group members");

  const shares = equalSplitCents(cents, participants.length);
  await db.expense.create({
    data: {
      userId: paidById, groupId, description, merchant: description,
      amount: centsToDecimalString(cents), categorySource: "MANUAL",
      splits: {
        create: participants
          .map((owedById, i) => ({ owedById, amount: centsToDecimalString(shares[i]) }))
          .filter((s) => s.owedById !== paidById),
      },
    },
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/");
}

// "We settled up": every open split in the group is marked paid. The
// suggested transfers on the page are what people should have paid to
// get here; recording each payment individually is a later feature.
export async function settleGroup(formData: FormData) {
  const me = await getOrCreateDemoUser();
  const groupId = String(formData.get("groupId") ?? "");
  await requireMembership(groupId, me.id);
  await db.split.updateMany({ where: { expense: { groupId }, settled: false }, data: { settled: true } });
  revalidatePath(`/groups/${groupId}`);
}
