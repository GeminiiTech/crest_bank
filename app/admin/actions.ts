"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminProfileSchema, adminBalanceSchema, adminTransactionSchema } from "@/lib/validations/admin";
import { beneficiarySchema } from "@/lib/validations/beneficiary";
import { computeBalanceAdjustment, signedDelta } from "@/lib/admin/adjustment";

export type AdminResult = { error: string } | { ok: true };

function revalidateUser(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin");
}

export async function updateUserProfile(userId: string, formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = adminProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    country: formData.get("country") || undefined,
    phone: formData.get("phone") || undefined,
    kyc_status: formData.get("kyc_status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      country: parsed.data.country || null,
      phone: parsed.data.phone || null,
      kyc_status: parsed.data.kyc_status,
    })
    .eq("id", userId);
  if (error) return { error: "Could not update the profile." };
  revalidateUser(userId);
  return { ok: true };
}

export async function setUserRole(userId: string, role: "customer" | "admin"): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  if (role !== "customer" && role !== "admin") return { error: "Invalid role." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: "Could not change the role." };
  revalidateUser(userId);
  return { ok: true };
}

export async function adjustAccountBalance(
  userId: string,
  accountId: string,
  formData: FormData
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = adminBalanceSchema.safeParse({ balance: formData.get("balance") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid balance." };
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("balance, currency")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { error: "Account not found." };

  const adj = computeBalanceAdjustment(Number(account.balance), parsed.data.balance);
  if (!adj) return { ok: true };
  const { error: balErr } = await admin.from("accounts").update({ balance: parsed.data.balance }).eq("id", accountId);
  if (balErr) return { error: "Could not update the balance." };
  await admin.from("transactions").insert({
    account_id: accountId,
    type: adj.type,
    category: "Adjustment",
    amount: adj.amount,
    currency: (account.currency as string) ?? "USD",
    status: "completed",
    description: "Admin balance adjustment",
    counterparty: "Admin",
  });
  revalidateUser(userId);
  return { ok: true };
}

export async function setAccountStatus(
  userId: string,
  accountId: string,
  status: "active" | "frozen" | "closed"
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  if (!["active", "frozen", "closed"].includes(status)) return { error: "Invalid status." };
  const admin = createAdminClient();
  const { error } = await admin.from("accounts").update({ status }).eq("id", accountId);
  if (error) return { error: "Could not update the account." };
  revalidateUser(userId);
  return { ok: true };
}

export async function addTransaction(
  userId: string,
  accountId: string,
  formData: FormData
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = adminTransactionSchema.safeParse({
    type: formData.get("type"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { data: account } = await admin.from("accounts").select("balance, currency").eq("id", accountId).maybeSingle();
  if (!account) return { error: "Account not found." };

  const { error: insErr } = await admin.from("transactions").insert({
    account_id: accountId,
    type: parsed.data.type,
    category: parsed.data.category,
    amount: parsed.data.amount,
    currency: (account.currency as string) ?? "USD",
    status: "completed",
    description: parsed.data.description || null,
    counterparty: "Admin",
  });
  if (insErr) return { error: "Could not add the transaction." };
  const newBalance = Number(account.balance) + signedDelta(parsed.data.type, parsed.data.amount);
  await admin.from("accounts").update({ balance: newBalance }).eq("id", accountId);
  revalidateUser(userId);
  return { ok: true };
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { data: txn } = await admin
    .from("transactions")
    .select("account_id, type, amount")
    .eq("id", transactionId)
    .maybeSingle();
  if (!txn) return { error: "Transaction not found." };
  const { error: delErr } = await admin.from("transactions").delete().eq("id", transactionId);
  if (delErr) return { error: "Could not delete the transaction." };
  const { data: account } = await admin.from("accounts").select("balance").eq("id", txn.account_id as string).maybeSingle();
  if (account) {
    const reversed = Number(account.balance) - signedDelta(txn.type as "credit" | "debit", Number(txn.amount));
    await admin.from("accounts").update({ balance: reversed }).eq("id", txn.account_id as string);
  }
  revalidateUser(userId);
  return { ok: true };
}

export async function setCardStatus(
  userId: string,
  cardId: string,
  status: "active" | "frozen"
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  if (status !== "active" && status !== "frozen") return { error: "Invalid status." };
  const admin = createAdminClient();
  const { error } = await admin.from("cards").update({ status }).eq("id", cardId);
  if (error) return { error: "Could not update the card." };
  revalidateUser(userId);
  return { ok: true };
}

function beneficiaryRow(d: ReturnType<typeof beneficiarySchema.parse>) {
  return {
    name: d.name,
    type: d.type,
    account_number: d.account_number,
    bank_name: d.bank_name || null,
    routing_number: d.routing_number || null,
    iban: d.iban || null,
  };
}

export async function createBeneficiaryFor(userId: string, formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = beneficiarySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    account_number: formData.get("account_number"),
    bank_name: formData.get("bank_name") || undefined,
    routing_number: formData.get("routing_number") || undefined,
    iban: formData.get("iban") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { error } = await admin.from("beneficiaries").insert({ ...beneficiaryRow(parsed.data), user_id: userId });
  if (error) return { error: "Could not add the beneficiary." };
  revalidateUser(userId);
  return { ok: true };
}

export async function updateBeneficiaryFor(userId: string, beneficiaryId: string, formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = beneficiarySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    account_number: formData.get("account_number"),
    bank_name: formData.get("bank_name") || undefined,
    routing_number: formData.get("routing_number") || undefined,
    iban: formData.get("iban") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { error } = await admin.from("beneficiaries").update(beneficiaryRow(parsed.data)).eq("id", beneficiaryId);
  if (error) return { error: "Could not update the beneficiary." };
  revalidateUser(userId);
  return { ok: true };
}

export async function deleteBeneficiaryFor(userId: string, beneficiaryId: string): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin.from("beneficiaries").delete().eq("id", beneficiaryId);
  if (error) return { error: "Could not delete the beneficiary." };
  revalidateUser(userId);
  return { ok: true };
}
