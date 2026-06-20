"use client";

import { useState, useTransition } from "react";
import type { AdminUserDetail } from "@/lib/admin/data";
import { updateUserProfile, setUserRole } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KYC = ["unverified", "pending", "verified", "rejected"] as const;
const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm";

export function ProfileEditor({ profile }: { profile: AdminUserDetail["profile"] }) {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = await updateUserProfile(profile.id, formData);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: "Saved." });
    });
  }

  function changeRole(role: "customer" | "admin") {
    setMsg(null);
    startTransition(async () => {
      const result = await setUserRole(profile.id, role);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: `Role set to ${role}.` });
    });
  }

  return (
    <form action={save} className="space-y-4">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{profile.email}</p>
      <div>
        <label htmlFor="ap-name" className="mb-1 block text-sm font-medium">Full name</label>
        <Input id="ap-name" name="full_name" defaultValue={profile.full_name ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ap-country" className="mb-1 block text-sm font-medium">Country</label>
          <Input id="ap-country" name="country" defaultValue={profile.country ?? ""} />
        </div>
        <div>
          <label htmlFor="ap-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <Input id="ap-phone" name="phone" defaultValue={profile.phone ?? ""} />
        </div>
      </div>
      <div>
        <label htmlFor="ap-kyc" className="mb-1 block text-sm font-medium">KYC status</label>
        <select id="ap-kyc" name="kyc_status" defaultValue={profile.kyc_status} className={selectClass}>
          {KYC.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        <span className="text-sm text-muted-foreground">Role: <strong>{profile.role}</strong></span>
        {profile.role === "admin" ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => changeRole("customer")}>
            Demote to customer
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => changeRole("admin")}>
            Promote to admin
          </Button>
        )}
      </div>
    </form>
  );
}
