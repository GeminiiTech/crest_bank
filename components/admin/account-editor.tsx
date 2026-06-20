"use client";

import { useState, useTransition } from "react";
import type { AdminAccount } from "@/lib/admin/data";
import { adjustAccountBalance, setAccountStatus } from "@/app/admin/actions";
import { accountTypeLabel } from "@/lib/dashboard/constants";
import { maskAccountNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUSES = ["active", "frozen", "closed"] as const;
const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

export function AccountEditor({ userId, account }: { userId: string; account: AdminAccount }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveBalance(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = await adjustAccountBalance(userId, account.id, formData);
      setMsg("error" in result ? result.error : "Balance updated.");
    });
  }

  function changeStatus(status: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await setAccountStatus(userId, account.id, status as "active" | "frozen" | "closed");
      setMsg("error" in result ? result.error : "Status updated.");
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="font-medium">{accountTypeLabel(account.type)} · {maskAccountNumber(account.account_number)}</p>
          <select className={selectClass} defaultValue={account.status} onChange={(e) => changeStatus(e.target.value)} disabled={pending} aria-label="Account status">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <form action={saveBalance} className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor={`bal-${account.id}`} className="mb-1 block text-xs font-medium text-muted-foreground">Balance ({account.currency})</label>
            <Input id={`bal-${account.id}`} name="balance" inputMode="decimal" defaultValue={account.balance.toFixed(2)} />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>Set balance</Button>
        </form>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
