export type TxnLike = {
  type: "credit" | "debit";
  category: string;
  amount: number;
  created_at: string;
};

function isSameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth()
  );
}

export function summarizeSpending(
  txns: TxnLike[],
  opts: { now?: Date } = {}
): { category: string; total: number }[] {
  const now = opts.now ?? new Date();
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "debit") continue;
    if (!isSameMonth(t.created_at, now)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export type Insights = {
  totalBalance: number;
  monthIncome: number;
  monthSpending: number;
  netCashFlow: number;
  savingsRate: number;
  topCategory: string | null;
};

export function computeInsights(
  accounts: { balance: number }[],
  txns: TxnLike[],
  opts: { now?: Date } = {}
): Insights {
  const now = opts.now ?? new Date();
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  let monthIncome = 0;
  let monthSpending = 0;
  for (const t of txns) {
    if (!isSameMonth(t.created_at, now)) continue;
    if (t.type === "credit") monthIncome += t.amount;
    else monthSpending += t.amount;
  }
  const netCashFlow = monthIncome - monthSpending;
  const savingsRate = monthIncome > 0 ? netCashFlow / monthIncome : 0;
  const spending = summarizeSpending(txns, { now });
  return {
    totalBalance,
    monthIncome,
    monthSpending,
    netCashFlow,
    savingsRate,
    topCategory: spending.length > 0 ? spending[0].category : null,
  };
}

export function deriveBalanceHistory(
  currentBalance: number,
  txns: TxnLike[],
  opts: { points?: number; now?: Date } = {}
): { date: string; balance: number }[] {
  if (txns.length === 0) {
    const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
    return [{ date: today, balance: currentBalance }];
  }
  const sorted = [...txns].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const net = sorted.reduce(
    (s, t) => s + (t.type === "credit" ? t.amount : -t.amount),
    0
  );
  let running = currentBalance - net;
  const byDate = new Map<string, number>();
  for (const t of sorted) {
    running += t.type === "credit" ? t.amount : -t.amount;
    byDate.set(t.created_at.slice(0, 10), running);
  }
  let series = [...byDate.entries()].map(([date, balance]) => ({ date, balance }));
  if (opts.points && series.length > opts.points) {
    series = series.slice(series.length - opts.points);
  }
  return series;
}
