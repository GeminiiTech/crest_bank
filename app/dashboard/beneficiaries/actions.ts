"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { beneficiarySchema } from "@/lib/validations/beneficiary";

export type BeneficiaryResult = { error: string } | { ok: true };

function parse(formData: FormData) {
  return beneficiarySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    account_number: formData.get("account_number"),
    bank_name: formData.get("bank_name") || undefined,
    routing_number: formData.get("routing_number") || undefined,
    iban: formData.get("iban") || undefined,
  });
}

function toRow(d: ReturnType<typeof beneficiarySchema.parse>) {
  return {
    name: d.name,
    type: d.type,
    account_number: d.account_number,
    bank_name: d.bank_name || null,
    routing_number: d.routing_number || null,
    iban: d.iban || null,
  };
}

export async function createBeneficiary(formData: FormData): Promise<BeneficiaryResult> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase.from("beneficiaries").insert({ ...toRow(parsed.data), user_id: user.id });
  if (error) return { error: "Could not save the beneficiary. Please try again." };
  revalidatePath("/dashboard/beneficiaries");
  return { ok: true };
}

export async function updateBeneficiary(id: string, formData: FormData): Promise<BeneficiaryResult> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  // Owner-scope explicitly (defense-in-depth alongside RLS).
  const { error } = await supabase
    .from("beneficiaries")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not update the beneficiary. Please try again." };
  revalidatePath("/dashboard/beneficiaries");
  return { ok: true };
}

export async function deleteBeneficiary(id: string): Promise<BeneficiaryResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase
    .from("beneficiaries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not delete the beneficiary. Please try again." };
  revalidatePath("/dashboard/beneficiaries");
  return { ok: true };
}
