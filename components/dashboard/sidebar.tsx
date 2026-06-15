"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { dashboardNav } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Dashboard">
      <div className="mb-6 px-2">
        <Logo inverted />
      </div>
      {dashboardNav.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        if (!item.enabled) {
          return (
            <span
              key={item.label}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-500"
              aria-disabled="true"
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </span>
              <span className="rounded-full bg-navy-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
