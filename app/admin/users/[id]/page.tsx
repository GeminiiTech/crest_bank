import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserDetail } from "@/lib/admin/data";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileEditor } from "@/components/admin/profile-editor";
import { AccountEditor } from "@/components/admin/account-editor";
import { TransactionManager } from "@/components/admin/transaction-manager";
import { CardToggle } from "@/components/admin/card-toggle";
import { BeneficiaryManager } from "@/components/admin/beneficiary-manager";

export const metadata: Metadata = { title: "Admin · User", robots: { index: false, follow: false } };

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const detail = await getUserDetail(params.id);
  if (!detail) notFound();
  const { profile, insights, accounts, transactions, cards, beneficiaries } = detail;

  const stat = [
    { label: "Total balance", value: insights.totalBalance },
    { label: "Income this month", value: insights.monthIncome },
    { label: "Spending this month", value: insights.monthSpending },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        {(profile.full_name ?? profile.email) || "User"}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stat.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent><ProfileEditor profile={profile} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts.</p>
          ) : (
            accounts.map((a) => <AccountEditor key={a.id} userId={profile.id} account={a} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>
          <TransactionManager userId={profile.id} accounts={accounts} transactions={transactions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cards</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards.</p>
          ) : (
            cards.map((c) => <CardToggle key={c.id} userId={profile.id} card={c} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Beneficiaries</CardTitle></CardHeader>
        <CardContent>
          <BeneficiaryManager userId={profile.id} beneficiaries={beneficiaries} />
        </CardContent>
      </Card>
    </div>
  );
}
