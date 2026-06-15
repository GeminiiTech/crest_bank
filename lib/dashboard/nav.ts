import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  Settings,
  Users,
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
  { label: "Beneficiaries", href: "/dashboard/beneficiaries", icon: Users, enabled: true },
  { label: "Transfers", href: "/dashboard/transfers", icon: ArrowLeftRight, enabled: true },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt, enabled: true },
  { label: "Cards", href: "/dashboard/cards", icon: CreditCard, enabled: true },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, enabled: true },
];
