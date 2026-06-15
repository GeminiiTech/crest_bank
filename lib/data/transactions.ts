import { createClient } from "@/lib/supabase/server";

export type Transaction = {
  id: string;
  account_id: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  counterparty: string | null;
  created_at: string;
};

const COLS =
  "id, account_id, type, category, amount, currency, status, description, counterparty, created_at";

function coerce(rows: Record<string, unknown>[]): Transaction[] {
  return rows.map((r) => ({ ...r, amount: Number(r.amount) })) as Transaction[];
}

export async function getRecentTransactions(limit = 6): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return coerce(data as Record<string, unknown>[]);
}

export async function getAccountTransactions(
  accountId: string,
  limit = 50
): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(COLS)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return coerce(data as Record<string, unknown>[]);
}
