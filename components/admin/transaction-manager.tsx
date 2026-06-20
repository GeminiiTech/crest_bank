"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { AdminAccount, AdminTransaction } from "@/lib/admin/data";
import { addTransaction, deleteTransaction } from "@/app/admin/actions";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

export function TransactionManager({
  userId,
  accounts,
  transactions,
}: {
  userId: string;
  accounts: AdminAccount[];
  transactions: AdminTransaction[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    if (!accountId) return;
    setMsg(null);
    startTransition(async () => {
      const result = await addTransaction(userId, accountId, formData);
      setMsg("error" in result ? result.error : "Transaction added.");
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this transaction? The account balance will be reversed.")) return;
    setMsg(null);
    startTransition(async () => {
      const result = await deleteTransaction(userId, id);
      setMsg("error" in result ? result.error : "Transaction deleted.");
    });
  }

  return (
    <div className="space-y-4">
      {accounts.length > 0 && (
        <form action={add} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Account</label>
            <select className={selectClass} value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_number.slice(-4)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
            <select name="type" className={selectClass} aria-label="Type">
              <option value="credit">credit</option>
              <option value="debit">debit</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
            <Input name="category" defaultValue="Adjustment" className="h-10 w-36" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount</label>
            <Input name="amount" inputMode="decimal" placeholder="0.00" className="h-10 w-28" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <Input name="description" className="h-10" />
          </div>
          <Button type="submit" disabled={pending}>Add</Button>
        </form>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-muted-foreground">{formatTxnDate(t.created_at)}</td>
                <td className="px-3 py-2">{t.description ?? t.counterparty ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.category}</td>
                <td className={cn("px-3 py-2 text-right font-semibold", t.type === "credit" ? "text-success" : "text-foreground")}>
                  {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount, t.currency)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(t.id)} aria-label="Delete transaction">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No transactions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
