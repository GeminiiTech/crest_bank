export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  current: "Current",
  business: "Business",
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABEL[type] ?? type;
}

export const TRANSACTION_CATEGORIES = [
  "Salary",
  "Transfer",
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Health",
  "Interest",
  "Refund",
  "general",
] as const;
