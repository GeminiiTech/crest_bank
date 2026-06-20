"use client";

import { useState, useTransition } from "react";
import type { AdminCard } from "@/lib/admin/data";
import { setCardStatus } from "@/app/admin/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CardToggle({ userId, card }: { userId: string; card: AdminCard }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const frozen = card.status !== "active";

  function toggle() {
    setMsg(null);
    startTransition(async () => {
      const result = await setCardStatus(userId, card.id, frozen ? "active" : "frozen");
      if ("error" in result) setMsg(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">{card.brand} {card.type} •••• {card.last4}</p>
          <p className="text-xs text-muted-foreground">exp {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}</p>
          {msg && <p className="mt-1 text-xs text-rose-500">{msg}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={card.status === "active" ? "success" : "secondary"}>{card.status}</Badge>
          <Button variant="outline" size="sm" disabled={pending || card.status === "cancelled"} onClick={toggle}>
            {frozen ? "Unfreeze" : "Freeze"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
