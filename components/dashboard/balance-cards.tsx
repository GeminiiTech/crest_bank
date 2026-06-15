import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Insights } from "@/lib/dashboard/insights";

export function BalanceCards({ insights }: { insights: Insights }) {
  const cards = [
    { label: "Total balance", value: insights.totalBalance, icon: Wallet, tone: "text-primary" },
    { label: "Income this month", value: insights.monthIncome, icon: TrendingUp, tone: "text-success" },
    { label: "Spending this month", value: insights.monthSpending, icon: TrendingDown, tone: "text-foreground" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className={`h-5 w-5 ${c.tone}`} />
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{formatCurrency(c.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
