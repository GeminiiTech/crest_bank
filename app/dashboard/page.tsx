import type { Metadata } from "next";
import { getAccounts } from "@/lib/data/accounts";
import { getRecentTransactions } from "@/lib/data/transactions";
import { getNotifications } from "@/lib/data/notifications";
import { computeInsights, summarizeSpending, type TxnLike } from "@/lib/dashboard/insights";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { InsightsPanel } from "@/components/dashboard/insights";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const accounts = await getAccounts();

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <DashboardEmptyState />
      </div>
    );
  }

  const recent = await getRecentTransactions(100);
  const txnLike: TxnLike[] = recent.map((t) => ({
    type: t.type,
    category: t.category,
    amount: t.amount,
    created_at: t.created_at,
  }));
  const insights = computeInsights(accounts, txnLike);
  const spending = summarizeSpending(txnLike);
  const notifications = await getNotifications();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
      <BalanceCards insights={insights} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={spending} />
          </CardContent>
        </Card>
        <InsightsPanel insights={insights} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions transactions={recent.slice(0, 6)} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
