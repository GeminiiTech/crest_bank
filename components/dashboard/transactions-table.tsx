import type { Transaction } from "@/lib/data/transactions";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TransactionsTable({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No transactions match these filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pr-4 font-medium">Date</th>
            <th className="py-3 pr-4 font-medium">Description</th>
            <th className="py-3 pr-4 font-medium">Category</th>
            <th className="py-3 pr-4 font-medium">Status</th>
            <th className="py-3 pl-4 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const credit = t.type === "credit";
            return (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-3 pr-4 text-muted-foreground">{formatTxnDate(t.created_at)}</td>
                <td className="py-3 pr-4">{t.description ?? t.counterparty ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{t.category}</td>
                <td className="py-3 pr-4 text-muted-foreground">{t.status}</td>
                <td className={cn("py-3 pl-4 text-right font-semibold", credit ? "text-success" : "text-foreground")}>
                  {credit ? "+" : "-"}
                  {formatCurrency(t.amount, t.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
