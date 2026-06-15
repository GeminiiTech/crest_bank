import Link from "next/link";
import type { Transaction } from "@/lib/data/transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionRow } from "@/components/dashboard/transaction-row";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Link href="/dashboard/accounts" className="text-sm font-medium text-primary hover:underline">
          View accounts
        </Link>
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
  );
}
