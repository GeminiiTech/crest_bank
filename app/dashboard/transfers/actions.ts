"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transferSchema } from "@/lib/validations/transfer";

export type TransferResult = { error: string } | { ok: true };

function mapTransferError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("insufficient")) return "You don't have enough funds for this transfer.";
  if (m.includes("same account")) return "Choose a different destination account.";
  if (m.includes("not active")) return "That account is not active.";
  if (m.includes("currency")) return "Both accounts must use the same currency.";
  if (m.includes("source account")) return "Source account not found.";
  if (m.includes("destination account")) return "Destination account not found.";
  if (m.includes("beneficiary")) return "Beneficiary not found.";
  return "We couldn't complete this transfer. Please try again.";
}

export async function executeTransfer(formData: FormData): Promise<TransferResult> {
  const raw = {
    mode: formData.get("mode"),
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId") || undefined,
    beneficiaryId: formData.get("beneficiaryId") || undefined,
    amount: formData.get("amount"),
    reference: formData.get("reference") || undefined,
  };
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const d = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.rpc("execute_transfer", {
    p_from_account: d.fromAccountId,
    p_to_account: d.mode === "internal" ? d.toAccountId : null,
    p_beneficiary: d.mode === "external" ? d.beneficiaryId : null,
    p_amount: d.amount,
    p_kind: d.mode === "internal" ? "internal" : "external",
    p_reference: d.reference ?? null,
  });
  if (error) return { error: mapTransferError((error as { message: string }).message) };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/accounts");
  return { ok: true };
}
