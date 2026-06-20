"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminUserRow } from "@/lib/admin/data";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (u.email + " " + (u.full_name ?? "")).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">KYC</th>
              <th className="px-4 py-3 font-medium">Accounts</th>
              <th className="px-4 py-3 text-right font-medium">Total balance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-accent/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                    {u.email || "(no email)"}
                  </Link>
                </td>
                <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.kyc_status}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.accountCount}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(u.totalBalance)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
