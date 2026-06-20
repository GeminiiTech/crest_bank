import { createAdminClient } from "@/lib/supabase/admin";
import { computeInsights, type Insights, type TxnLike } from "@/lib/dashboard/insights";

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "customer" | "admin";
  kyc_status: string;
  accountCount: number;
  totalBalance: number;
  created_at: string;
};

export type AdminAccount = {
  id: string;
  account_number: string;
  type: string;
  currency: string;
  balance: number;
  status: string;
};
export type AdminTransaction = {
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
export type AdminCard = {
  id: string;
  account_id: string;
  brand: string;
  type: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
  is_virtual: boolean;
};
export type AdminBeneficiary = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string;
  routing_number: string | null;
  iban: string | null;
  type: string;
};

export type AdminUserDetail = {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    country: string | null;
    phone: string | null;
    role: "customer" | "admin";
    kyc_status: string;
    created_at: string;
  };
  insights: Insights;
  accounts: AdminAccount[];
  transactions: AdminTransaction[];
  cards: AdminCard[];
  beneficiaries: AdminBeneficiary[];
};

export async function listUsers(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: accounts }, authList] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, kyc_status, created_at"),
    admin.from("accounts").select("user_id, balance"),
    admin.auth.admin.listUsers(),
  ]);

  const emailById = new Map<string, string>();
  for (const u of authList.data?.users ?? []) emailById.set(u.id, u.email ?? "");

  const agg = new Map<string, { count: number; total: number }>();
  for (const a of (accounts ?? []) as { user_id: string; balance: string | number }[]) {
    const cur = agg.get(a.user_id) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(a.balance);
    agg.set(a.user_id, cur);
  }

  return ((profiles ?? []) as Record<string, unknown>[])
    .map((p) => {
      const id = p.id as string;
      const a = agg.get(id) ?? { count: 0, total: 0 };
      return {
        id,
        email: emailById.get(id) ?? "",
        full_name: (p.full_name as string | null) ?? null,
        role: (p.role as "customer" | "admin") ?? "customer",
        kyc_status: (p.kyc_status as string) ?? "unverified",
        accountCount: a.count,
        totalBalance: a.total,
        created_at: p.created_at as string,
      };
    })
    .sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, country, phone, role, kyc_status, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  const { data: accountsRaw } = await admin
    .from("accounts")
    .select("id, account_number, type, currency, balance, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const accounts = ((accountsRaw ?? []) as Record<string, unknown>[]).map((a) => ({
    ...a,
    balance: Number(a.balance),
  })) as AdminAccount[];
  const accountIds = accounts.map((a) => a.id);

  const txnCols =
    "id, account_id, type, category, amount, currency, status, description, counterparty, created_at";
  const { data: txnRaw } = accountIds.length
    ? await admin.from("transactions").select(txnCols).in("account_id", accountIds).order("created_at", { ascending: false }).limit(100)
    : { data: [] as Record<string, unknown>[] };
  const transactions = ((txnRaw ?? []) as Record<string, unknown>[]).map((t) => ({
    ...t,
    amount: Number(t.amount),
  })) as AdminTransaction[];

  const { data: cardsRaw } = accountIds.length
    ? await admin.from("cards").select("id, account_id, brand, type, last4, exp_month, exp_year, status, is_virtual").in("account_id", accountIds)
    : { data: [] as Record<string, unknown>[] };
  const cards = (cardsRaw ?? []) as AdminCard[];

  const { data: benRaw } = await admin
    .from("beneficiaries")
    .select("id, name, bank_name, account_number, routing_number, iban, type")
    .eq("user_id", userId);
  const beneficiaries = (benRaw ?? []) as AdminBeneficiary[];

  const txnLike: TxnLike[] = transactions.map((t) => ({
    type: t.type,
    category: t.category,
    amount: t.amount,
    created_at: t.created_at,
  }));
  const insights = computeInsights(accounts.map((a) => ({ balance: a.balance })), txnLike);

  return {
    profile: {
      id: profile.id as string,
      email: authUser?.user?.email ?? "",
      full_name: (profile.full_name as string | null) ?? null,
      country: (profile.country as string | null) ?? null,
      phone: (profile.phone as string | null) ?? null,
      role: (profile.role as "customer" | "admin") ?? "customer",
      kyc_status: (profile.kyc_status as string) ?? "unverified",
      created_at: profile.created_at as string,
    },
    insights,
    accounts,
    transactions,
    cards,
    beneficiaries,
  };
}
