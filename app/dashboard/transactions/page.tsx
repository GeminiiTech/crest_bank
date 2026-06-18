import type { Metadata } from "next";
import { Download } from "lucide-react";
import { getAccounts } from "@/lib/data/accounts";
import { getTransactionsPage } from "@/lib/data/transactions";
import { parseTransactionQuery } from "@/lib/transactions/filters";
import { TransactionsFilters } from "@/components/dashboard/transactions-filters";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { Pagination } from "@/components/dashboard/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseTransactionQuery(searchParams);
  const [accounts, { rows, total }] = await Promise.all([
    getAccounts(),
    getTransactionsPage(query),
  ]);

  const exportParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => {
    if (typeof v === "string" && v) exportParams.set(k, v);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Transactions</h1>
        <Button asChild variant="outline">
          <a href={`/dashboard/transactions/export?${exportParams.toString()}`} data-tour="transactions-export">
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </a>
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-5 p-5">
          <TransactionsFilters accounts={accounts} />
          <div data-tour="transactions-table"><TransactionsTable rows={rows} /></div>
          <Pagination page={query.page} pageSize={query.pageSize} total={total} />
        </CardContent>
      </Card>
    </div>
  );
}
