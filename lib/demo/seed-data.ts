export type AccountSeed = {
  account_number: string;
  type: "checking" | "savings";
  currency: string;
  balance: number;
  status: "active";
};

export type TxnSeed = {
  type: "credit" | "debit";
  category: string;
  amount: number;
  description: string;
  counterparty: string | null;
  created_at: string;
};

export type NotificationSeed = {
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
};

export function buildDemoAccounts(seed: number): AccountSeed[] {
  const base = 100000000000 + (Math.abs(seed) % 800000000000);
  return [
    { account_number: String(base), type: "checking", currency: "USD", balance: 12450.75, status: "active" },
    { account_number: String(base + 1), type: "savings", currency: "USD", balance: 36800.0, status: "active" },
  ];
}

const CHECKING: Omit<TxnSeed, "created_at">[] = [
  { type: "credit", category: "Salary", amount: 5400, description: "Monthly salary", counterparty: "Acme Corp" },
  { type: "debit", category: "Groceries", amount: 86.4, description: "Whole Foods", counterparty: "Whole Foods" },
  { type: "debit", category: "Dining", amount: 42.1, description: "Dinner", counterparty: "Olive & Vine" },
  { type: "debit", category: "Transport", amount: 18.75, description: "Ride", counterparty: "Uber" },
  { type: "debit", category: "Shopping", amount: 129.0, description: "Apparel", counterparty: "Uniqlo" },
  { type: "debit", category: "Utilities", amount: 64.3, description: "Electricity", counterparty: "City Power" },
  { type: "debit", category: "Groceries", amount: 53.2, description: "Trader Joe's", counterparty: "Trader Joe's" },
  { type: "debit", category: "Dining", amount: 27.5, description: "Coffee & lunch", counterparty: "Blue Bottle" },
  { type: "debit", category: "Entertainment", amount: 15.99, description: "Streaming", counterparty: "Netflix" },
  { type: "debit", category: "Transport", amount: 45.0, description: "Fuel", counterparty: "Shell" },
  { type: "debit", category: "Groceries", amount: 92.1, description: "Costco", counterparty: "Costco" },
  { type: "debit", category: "Shopping", amount: 220.0, description: "Electronics", counterparty: "Best Buy" },
  { type: "debit", category: "Dining", amount: 61.4, description: "Restaurant", counterparty: "Sushi Ko" },
  { type: "credit", category: "Refund", amount: 39.99, description: "Return refund", counterparty: "Amazon" },
  { type: "debit", category: "Utilities", amount: 39.5, description: "Internet", counterparty: "Comcast" },
  { type: "debit", category: "Health", amount: 25.0, description: "Pharmacy", counterparty: "CVS" },
  { type: "debit", category: "Groceries", amount: 47.8, description: "Groceries", counterparty: "Safeway" },
  { type: "debit", category: "Transport", amount: 12.25, description: "Transit", counterparty: "Metro" },
  { type: "debit", category: "Dining", amount: 33.6, description: "Brunch", counterparty: "The Mill" },
  { type: "credit", category: "Salary", amount: 5400, description: "Monthly salary", counterparty: "Acme Corp" },
  { type: "debit", category: "Shopping", amount: 74.2, description: "Home goods", counterparty: "IKEA" },
  { type: "debit", category: "Entertainment", amount: 49.0, description: "Concert", counterparty: "Tickets" },
];

const SAVINGS: Omit<TxnSeed, "created_at">[] = [
  { type: "credit", category: "Transfer", amount: 1000, description: "Transfer to savings", counterparty: "Self" },
  { type: "credit", category: "Interest", amount: 42.18, description: "Monthly interest", counterparty: "Crest Bank" },
  { type: "credit", category: "Transfer", amount: 750, description: "Transfer to savings", counterparty: "Self" },
  { type: "debit", category: "Transfer", amount: 300, description: "Transfer to checking", counterparty: "Self" },
  { type: "credit", category: "Interest", amount: 39.9, description: "Monthly interest", counterparty: "Crest Bank" },
];

export function buildDemoTransactions(opts: {
  now: Date;
  profile?: "checking" | "savings";
}): TxnSeed[] {
  const templates = opts.profile === "savings" ? SAVINGS : CHECKING;
  const dayMs = 24 * 60 * 60 * 1000;
  return templates.map((t, i) => ({
    ...t,
    created_at: new Date(opts.now.getTime() - i * 2 * dayMs).toISOString(),
  }));
}

export function buildDemoNotifications(userId: string): NotificationSeed[] {
  return [
    { user_id: userId, title: "Welcome to Crest Bank", body: "Your account is ready. Explore your dashboard.", type: "info", is_read: false },
    { user_id: userId, title: "Your card is on the way", body: "Your Crest debit card has shipped.", type: "info", is_read: false },
    { user_id: userId, title: "Security tip", body: "Enable two-factor authentication for extra protection.", type: "security", is_read: true },
  ];
}
