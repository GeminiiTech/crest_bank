"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationsPopover } from "@/components/dashboard/notifications-popover";
import type { Notification } from "@/lib/data/notifications";

export function Topbar({
  name,
  email,
  notifications,
}: {
  name: string;
  email: string;
  notifications: Notification[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-navy-900 px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-navy-700 bg-navy-900 p-0">
            <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
            <SidebarNav />
          </SheetContent>
        </Sheet>
        <span className="font-display text-sm font-semibold text-white lg:hidden">Crest Bank</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsPopover notifications={notifications} />
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
