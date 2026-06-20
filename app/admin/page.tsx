import type { Metadata } from "next";
import { listUsers } from "@/lib/admin/data";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Admin · Users", robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  const users = await listUsers();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">{users.length} total</p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
