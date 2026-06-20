export function signedDelta(type: "credit" | "debit", amount: number): number {
  return type === "credit" ? amount : -amount;
}

export function computeBalanceAdjustment(
  current: number,
  next: number
): { type: "credit" | "debit"; amount: number } | null {
  const diff = Number((next - current).toFixed(2));
  if (diff === 0) return null;
  return diff > 0
    ? { type: "credit", amount: diff }
    : { type: "debit", amount: Math.abs(diff) };
}
