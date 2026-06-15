"use client";

import { Bell } from "lucide-react";
import type { Notification } from "@/lib/data/notifications";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function NotificationsPopover({ notifications }: { notifications: Notification[] }) {
  const unread = notifications.filter((n) => !n.is_read).length;
  return (
    <Popover>
      <PopoverTrigger
        className="relative grid h-9 w-9 place-items-center rounded-full text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </PopoverTrigger>
      <PopoverContent>
        <p className="px-1 pb-2 text-sm font-semibold">Notifications</p>
        {notifications.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="space-y-1">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg px-2 py-2 hover:bg-accent">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
