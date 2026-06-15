import type { Metadata } from "next";
import Link from "next/link";
import { getCards } from "@/lib/data/cards";
import { getAccounts } from "@/lib/data/accounts";
import { CardsGrid } from "@/components/dashboard/cards-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const [cards, accounts] = await Promise.all([getCards(), getAccounts()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Cards</h1>
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
        <CardsGrid cards={cards} accounts={accounts} />
      )}
    </div>
  );
}
