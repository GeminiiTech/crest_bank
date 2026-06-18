"use client";

import { useState, useTransition } from "react";
import { Snowflake, Sun, Plus } from "lucide-react";
import type { Card as CardType } from "@/lib/data/cards";
import type { Account } from "@/lib/data/accounts";
import { requestVirtualCard, setCardStatus } from "@/app/dashboard/cards/actions";
import { nextCardStatus } from "@/lib/cards";
import { accountTypeLabel } from "@/lib/dashboard/constants";
import { CardVisual } from "@/components/dashboard/card-visual";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CardsGrid({ cards, accounts }: { cards: CardType[]; accounts: Account[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  function toggle(card: CardType) {
    setError(null);
    startTransition(async () => {
      const result = await setCardStatus(card.id, nextCardStatus(card.status));
      if ("error" in result) setError(result.error);
    });
  }

  function request() {
    setError(null);
    startTransition(async () => {
      const result = await requestVirtualCard(accountId);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card data-tour="cards-request">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="flex-1">
            <label htmlFor="card-account" className="mb-1 block text-sm font-medium">Request a virtual card for</label>
            <select
              id="card-account"
              className="flex h-11 w-full max-w-sm rounded-xl border border-input bg-background px-4 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{accountTypeLabel(a.type)}</option>
              ))}
            </select>
          </div>
          <Button onClick={request} disabled={pending || accounts.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Request virtual card
          </Button>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

      {cards.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center text-sm text-muted-foreground">
            No cards yet. Request your first card above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-tour="cards-manage">
          {cards.map((card) => (
            <div key={card.id} className="space-y-3">
              <CardVisual card={card} />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={pending || card.status === "cancelled"}
                onClick={() => toggle(card)}
              >
                {card.status === "active" ? (
                  <><Snowflake className="mr-1.5 h-4 w-4" /> Freeze</>
                ) : (
                  <><Sun className="mr-1.5 h-4 w-4" /> Unfreeze</>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
