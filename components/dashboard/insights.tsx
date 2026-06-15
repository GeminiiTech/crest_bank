import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Insights } from "@/lib/dashboard/insights";

export function InsightsPanel({ insights }: { insights: Insights }) {
  const rows = [
    { label: "Net cash flow", value: formatCurrency(insights.netCashFlow) },
    { label: "Savings rate", value: `${Math.round(insights.savingsRate * 100)}%` },
    { label: "Top category", value: insights.topCategory ?? "—" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold">{r.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
