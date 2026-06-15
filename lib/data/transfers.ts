import { createClient } from "@/lib/supabase/server";

export type Transfer = {
  id: string;
  amount: number;
  currency: string;
  kind: "internal" | "external" | "wire";
  status: string;
  reference: string | null;
  created_at: string;
};

export async function getRecentTransfers(limit = 8): Promise<Transfer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfers")
    .select("id, amount, currency, kind, status, reference, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((t) => ({ ...t, amount: Number(t.amount) })) as Transfer[];
}
