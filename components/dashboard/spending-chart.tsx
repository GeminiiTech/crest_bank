"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

export function SpendingChart({ data }: { data: { category: string; total: number }[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No spending this month yet.</p>;
  }
  return (
    <div role="img" aria-label="Spending by category this month" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis
            dataKey="category"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(v) => [formatCurrency(Number(v)), "Spent"]}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="hsl(var(--primary))" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
