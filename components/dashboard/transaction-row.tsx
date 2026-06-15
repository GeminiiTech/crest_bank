import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Transaction } from "@/lib/data/transactions";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TransactionRow({ txn }: { txn: Transaction }) {
  const credit = txn.type === "credit";
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full",
            credit ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}
        >
          {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{txn.description ?? txn.category}</p>
          <p className="text-xs text-muted-foreground">
            {txn.category} · {formatTxnDate(txn.created_at)}
          </p>
        </div>
      </div>
      <span className={cn("shrink-0 text-sm font-semibold", credit ? "text-success" : "text-foreground")}>
        {credit ? "+" : "-"}
        {formatCurrency(txn.amount, txn.currency)}
      </span>
    </li>
  );
}
