"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCard } from "@/lib/cards";

export type CardResult = { error: string } | { ok: true };

export async function requestVirtualCard(accountId: string): Promise<CardResult> {
  if (!accountId) return { error: "Choose an account." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { error: "Account not found." };

  const seed = Math.floor(new Date().getTime() % 1_000_000);
  const card = buildCard(seed, { isVirtual: true });
  const { error } = await supabase.from("cards").insert({ ...card, account_id: accountId });
  if (error) return { error: "Could not create the card. Please try again." };
  revalidatePath("/dashboard/cards");
  return { ok: true };
}

export async function setCardStatus(
  cardId: string,
  status: "active" | "frozen"
): Promise<CardResult> {
  if (status !== "active" && status !== "frozen") return { error: "Invalid status." };
  const supabase = createClient();
  const { error } = await supabase.from("cards").update({ status }).eq("id", cardId);
  if (error) return { error: "Could not update the card. Please try again." };
  revalidatePath("/dashboard/cards");
  return { ok: true };
}
