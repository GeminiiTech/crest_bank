import { createClient } from "@/lib/supabase/server";

export type Account = {
  id: string;
  account_number: string;
  type: string;
  currency: string;
  balance: number;
  status: string;
};

const COLS = "id, account_number, type, currency, balance, status";

export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(COLS)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((a: Record<string, unknown>) => ({ ...a, balance: Number(a.balance) })) as Account[];
}

export async function getAccountById(id: string): Promise<Account | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as Record<string, unknown>), balance: Number((data as Record<string, unknown>).balance) } as Account;
}
