import type { Metadata } from "next";
import Link from "next/link";
import { getAccounts } from "@/lib/data/accounts";
import { AccountCard } from "@/components/dashboard/account-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Accounts</h1>
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">You don&apos;t have any accounts yet.</p>
            <Button asChild>
              <Link href="/dashboard">Go to dashboard to set up demo data</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      )}
    </div>
  );
}
