import { createClient } from "@/lib/supabase/server";

export type Beneficiary = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string;
  routing_number: string | null;
  iban: string | null;
  type: "internal" | "external" | "wire";
  is_favorite: boolean;
};

const COLS = "id, name, bank_name, account_number, routing_number, iban, type, is_favorite";

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("beneficiaries")
    .select(COLS)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Beneficiary[];
}

export async function getBeneficiaryById(id: string): Promise<Beneficiary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("beneficiaries").select(COLS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Beneficiary;
}
