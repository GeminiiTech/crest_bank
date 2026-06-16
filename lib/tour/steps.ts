export type TourStep = { key: string; title: string; body: string };

// `key` matches the `data-tour` attribute on the corresponding sidebar link.
export const tourSteps: TourStep[] = [
  { key: "dashboard", title: "Your dashboard", body: "See your balances, spending, recent activity, and notifications at a glance." },
  { key: "accounts", title: "Accounts", body: "Open any account to view its balance history and transactions." },
  { key: "beneficiaries", title: "Beneficiaries", body: "Save the people and businesses you want to pay." },
  { key: "transfers", title: "Transfers", body: "Move money between your own accounts or send to a beneficiary." },
  { key: "transactions", title: "Transactions", body: "Search, filter, and export your full transaction history." },
  { key: "cards", title: "Cards", body: "View your cards, freeze or unfreeze them, or request a virtual card." },
  { key: "settings", title: "Settings", body: "Update your profile and avatar, change your password, and set notification preferences." },
];
