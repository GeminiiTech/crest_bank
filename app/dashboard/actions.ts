"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildDemoAccounts,
  buildDemoTransactions,
  buildDemoNotifications,
} from "@/lib/demo/seed-data";

export type SeedResult = { error: string } | void;

export async function seedDemoData(): Promise<SeedResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase.from("accounts").select("id").limit(1);
  if (existing && existing.length > 0) return; // idempotent

  const now = new Date();
  const seed = Math.floor(now.getTime() % 800000000000);
  const accountRows = buildDemoAccounts(seed).map((a) => ({ ...a, user_id: user.id }));
  const { data: inserted, error: accErr } = await supabase
    .from("accounts")
    .insert(accountRows)
    .select("id, type");
  if (accErr || !inserted) {
    return { error: "Could not create demo accounts. Please try again." };
  }

  const txnRows = (inserted as { id: string; type: string }[]).flatMap(
    (acc: { id: string; type: string }) =>
      buildDemoTransactions({
        now,
        profile: acc.type === "savings" ? "savings" : "checking",
      }).map((t) => ({
        account_id: acc.id,
        type: t.type,
        category: t.category,
        amount: t.amount,
        currency: "USD",
        status: "completed",
        description: t.description,
        counterparty: t.counterparty,
        created_at: t.created_at,
      }))
  );
  const { error: txnErr } = await supabase.from("transactions").insert(txnRows);
  if (txnErr) {
    return { error: "Could not create demo transactions. Please try again." };
  }

  await supabase.from("notifications").insert(buildDemoNotifications(user.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
}
