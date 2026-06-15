import { createClient } from "@/lib/supabase/server";

export type Card = {
  id: string;
  account_id: string;
  brand: string;
  type: "debit" | "credit";
  last4: string;
  exp_month: number;
  exp_year: number;
  status: "active" | "frozen" | "cancelled";
  is_virtual: boolean;
};

export async function getCards(): Promise<Card[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cards")
    .select("id, account_id, brand, type, last4, exp_month, exp_year, status, is_virtual")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Card[];
}
