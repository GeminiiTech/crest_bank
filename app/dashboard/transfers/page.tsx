import type { Metadata } from "next";
import Link from "next/link";
import { getAccounts } from "@/lib/data/accounts";
import { getBeneficiaries } from "@/lib/data/beneficiaries";
import { getRecentTransfers } from "@/lib/data/transfers";
import { TransferForm } from "@/components/dashboard/transfer-form";
import { RecentTransfers } from "@/components/dashboard/recent-transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Transfers" };

export default async function TransfersPage() {
  const [accounts, beneficiaries, transfers] = await Promise.all([
    getAccounts(),
    getBeneficiaries(),
    getRecentTransfers(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Transfers</h1>
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center text-sm text-muted-foreground">
            You need an account first.{" "}
            <Button asChild variant="link" className="px-1">
              <Link href="/dashboard">Set up demo data</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>New transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <TransferForm accounts={accounts} beneficiaries={beneficiaries} />
            </CardContent>
          </Card>
          <RecentTransfers transfers={transfers} />
        </div>
      )}
    </div>
  );
}
