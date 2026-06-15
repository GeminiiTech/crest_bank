"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

export function BalanceHistoryChart({ data }: { data: { date: string; balance: number }[] }) {
  const gradientId = useId();
  return (
    <div role="img" aria-label="Balance history" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v) => [formatCurrency(Number(v)), "Balance"]}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
