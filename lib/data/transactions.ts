import { createClient } from "@/lib/supabase/server";
import type { TransactionQuery } from "@/lib/transactions/filters";

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

export async function getTransactionsPage(
  q: TransactionQuery
): Promise<{ rows: Transaction[]; total: number }> {
  const supabase = createClient();
  let query = supabase.from("transactions").select(COLS, { count: "exact" });

  if (q.accountId) query = query.eq("account_id", q.accountId);
  if (q.type) query = query.eq("type", q.type);
  if (q.category) query = query.eq("category", q.category);
  if (q.from) query = query.gte("created_at", q.from);
  if (q.to) query = query.lte("created_at", `${q.to}T23:59:59.999Z`);
  if (q.search) {
    const safe = q.search.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`description.ilike.%${safe}%,counterparty.ilike.%${safe}%`);
  }

  const offset = (q.page - 1) * q.pageSize;
  query = query.order("created_at", { ascending: false }).range(offset, offset + q.pageSize - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };
  return {
    rows: (data as Record<string, unknown>[]).map((r) => ({ ...r, amount: Number(r.amount) })) as Transaction[],
    total: count ?? 0,
  };
}
