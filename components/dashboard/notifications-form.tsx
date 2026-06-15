"use client";

import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/app/dashboard/settings/actions";
import type { NotificationPrefsValue } from "@/lib/data/profile";
import { Button } from "@/components/ui/button";

const ITEMS: { key: keyof NotificationPrefsValue; label: string; desc: string }[] = [
  { key: "product", label: "Product updates", desc: "News about features and improvements." },
  { key: "security", label: "Security alerts", desc: "Sign-ins and security-related activity." },
  { key: "transfers", label: "Transfer activity", desc: "Notifications when money moves." },
];

export function NotificationsForm({ prefs }: { prefs: NotificationPrefsValue }) {
  const [state, setState] = useState<NotificationPrefsValue>(prefs);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    const fd = new FormData();
    fd.set("product", state.product ? "true" : "false");
    fd.set("security", state.security ? "true" : "false");
    fd.set("transfers", state.transfers ? "true" : "false");
    startTransition(async () => {
      const result = await updateNotificationPrefs(fd);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: "Preferences saved." });
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <ul className="space-y-3">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4">
            <label htmlFor={`nt-${item.key}`} className="cursor-pointer">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.desc}</span>
            </label>
            <input
              id={`nt-${item.key}`}
              type="checkbox"
              className="h-5 w-5 rounded border-input"
              checked={state[item.key]}
              onChange={(e) => setState((s) => ({ ...s, [item.key]: e.target.checked }))}
            />
          </li>
        ))}
      </ul>
      <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
    </div>
  );
}
