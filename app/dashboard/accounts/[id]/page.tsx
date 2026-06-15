import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAccountById } from "@/lib/data/accounts";
import { getAccountTransactions } from "@/lib/data/transactions";
import { deriveBalanceHistory, type TxnLike } from "@/lib/dashboard/insights";
import { formatCurrency, maskAccountNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceHistoryChart } from "@/components/dashboard/balance-history-chart";
import { TransactionRow } from "@/components/dashboard/transaction-row";

export const metadata: Metadata = { title: "Account" };

const TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  current: "Current",
  business: "Business",
};

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const account = await getAccountById(params.id);
  if (!account) notFound();

  const transactions = await getAccountTransactions(account.id, 50);
  const txnLike: TxnLike[] = transactions.map((t) => ({
    type: t.type,
    category: t.category,
    amount: t.amount,
    created_at: t.created_at,
  }));
  const history = deriveBalanceHistory(account.balance, txnLike);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {TYPE_LABEL[account.type] ?? account.type}
            </p>
            <Badge variant={account.status === "active" ? "success" : "secondary"}>
              {account.status}
            </Badge>
          </div>
          <p className="mt-3 font-display text-3xl font-bold">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {maskAccountNumber(account.account_number)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance history</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceHistoryChart data={history} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t) => (
                <TransactionRow key={t.id} txn={t} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
