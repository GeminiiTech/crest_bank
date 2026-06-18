export type TourStep = { key: string | null; title: string; body: string };

export type TourId =
  | "overview"
  | "accounts"
  | "beneficiaries"
  | "transfers"
  | "transactions"
  | "cards"
  | "settings";

export const tours: Record<TourId, TourStep[]> = {
  overview: [
    { key: "dashboard", title: "Your dashboard", body: "See your balances, spending, recent activity, and notifications at a glance." },
    { key: "accounts", title: "Accounts", body: "Open any account to view its balance history and transactions." },
    { key: "beneficiaries", title: "Beneficiaries", body: "Save the people and businesses you want to pay." },
    { key: "transfers", title: "Transfers", body: "Move money between your own accounts or send to a beneficiary." },
    { key: "transactions", title: "Transactions", body: "Search, filter, and export your full transaction history." },
    { key: "cards", title: "Cards", body: "View your cards, freeze or unfreeze them, or request a virtual card." },
    { key: "settings", title: "Settings", body: "Update your profile and avatar, change your password, and set notification preferences." },
  ],
  accounts: [
    { key: null, title: "Your accounts", body: "Every account you hold, with its balance." },
    { key: "accounts-grid", title: "Open an account", body: "Select a card to see its balance history and transactions." },
  ],
  beneficiaries: [
    { key: "beneficiaries-add", title: "Add a beneficiary", body: "Save the people and businesses you want to pay." },
    { key: "beneficiaries-list", title: "Manage beneficiaries", body: "Edit or remove saved beneficiaries here." },
  ],
  transfers: [
    { key: "transfers-mode", title: "Pick a transfer type", body: "Move money between your own accounts, or send to a beneficiary." },
    { key: "transfers-from", title: "Choose the source", body: "Select the account the money comes from." },
    { key: "transfers-amount", title: "Enter an amount", body: "It must be at or below the source account's balance." },
    { key: "transfers-send", title: "Send it", body: "Transfers post instantly and update your balances." },
  ],
  transactions: [
    { key: "transactions-filters", title: "Filter & search", body: "Narrow by account, type, category, date, or text." },
    { key: "transactions-export", title: "Export", body: "Download the filtered results as a CSV." },
    { key: "transactions-table", title: "Your history", body: "Transactions, newest first — use the pager to move through pages." },
  ],
  cards: [
    { key: "cards-request", title: "Request a card", body: "Create a virtual card for any account." },
    { key: "cards-manage", title: "Manage cards", body: "Freeze or unfreeze a card anytime." },
  ],
  settings: [
    { key: "settings-profile", title: "Profile", body: "Update your name, contact details, and photo." },
    { key: "settings-security", title: "Security", body: "Change your password here." },
    { key: "settings-notifications", title: "Notifications", body: "Choose what we notify you about." },
  ],
};

const PATH_TO_TOUR: Record<string, TourId> = {
  "/dashboard": "overview",
  "/dashboard/accounts": "accounts",
  "/dashboard/beneficiaries": "beneficiaries",
  "/dashboard/transfers": "transfers",
  "/dashboard/transactions": "transactions",
  "/dashboard/cards": "cards",
  "/dashboard/settings": "settings",
};

export function tourIdForPath(pathname: string): TourId | null {
  return PATH_TO_TOUR[pathname] ?? null;
}
