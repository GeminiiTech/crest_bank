export type GeneratedCard = {
  brand: string;
  type: "debit" | "credit";
  last4: string;
  exp_month: number;
  exp_year: number;
  is_virtual: boolean;
  status: "active";
};

export function buildCard(
  seed: number,
  opts: { type?: "debit" | "credit"; isVirtual?: boolean; now?: Date } = {}
): GeneratedCard {
  const now = opts.now ?? new Date();
  const n = Math.abs(Math.trunc(seed));
  return {
    brand: "Visa",
    type: opts.type ?? "debit",
    last4: String(n % 10000).padStart(4, "0"),
    exp_month: (n % 12) + 1,
    exp_year: now.getUTCFullYear() + 3,
    is_virtual: opts.isVirtual ?? false,
    status: "active",
  };
}

export function nextCardStatus(
  current: "active" | "frozen" | "cancelled"
): "active" | "frozen" {
  return current === "active" ? "frozen" : "active";
}
