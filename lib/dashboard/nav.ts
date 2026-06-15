import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

export const dashboardNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Accounts", href: "/dashboard/accounts", icon: Wallet, enabled: true },
  { label: "Transfers", href: "/dashboard/transfers", icon: ArrowLeftRight, enabled: false },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt, enabled: false },
  { label: "Cards", href: "/dashboard/cards", icon: CreditCard, enabled: false },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, enabled: false },
];
