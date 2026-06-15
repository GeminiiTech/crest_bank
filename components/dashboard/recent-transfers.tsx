import type { Transfer } from "@/lib/data/transfers";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<string, string> = {
  internal: "Between accounts",
  external: "To beneficiary",
  wire: "Wire",
};

export function RecentTransfers({ transfers }: { transfers: Transfer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transfers</CardTitle>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <ul className="divide-y">
            {transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{KIND_LABEL[t.kind] ?? t.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTxnDate(t.created_at)}
                    {t.reference ? ` · ${t.reference}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatCurrency(t.amount, t.currency)}</span>
                  <Badge variant={t.status === "completed" ? "success" : "secondary"}>{t.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
