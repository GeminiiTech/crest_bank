"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Account } from "@/lib/data/accounts";
import { TRANSACTION_CATEGORIES, accountTypeLabel } from "@/lib/dashboard/constants";
import { Input } from "@/components/ui/input";

export function TransactionsFilters({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`/dashboard/transactions?${next.toString()}`);
    },
    [params, router]
  );

  return (
    <div className="flex flex-wrap items-end gap-3" data-tour="transactions-filters">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="f-search" className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
        <Input
          id="f-search"
          defaultValue={params.get("search") ?? ""}
          placeholder="Description or counterparty"
          onKeyDown={(e) => {
            if (e.key === "Enter") update("search", (e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <div>
        <label htmlFor="f-account" className="mb-1 block text-xs font-medium text-muted-foreground">Account</label>
        <select id="f-account" className={selectClass} defaultValue={params.get("accountId") ?? ""} onChange={(e) => update("accountId", e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{accountTypeLabel(a.type)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-type" className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
        <select id="f-type" className={selectClass} defaultValue={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)}>
          <option value="">All</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-cat" className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
        <select id="f-cat" className={selectClass} defaultValue={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
          <option value="">All</option>
          {TRANSACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-from" className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
        <input id="f-from" type="date" className={selectClass} defaultValue={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
      </div>
      <div>
        <label htmlFor="f-to" className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
        <input id="f-to" type="date" className={selectClass} defaultValue={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
      </div>
    </div>
  );
}
