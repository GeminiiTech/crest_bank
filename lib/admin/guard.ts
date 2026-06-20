import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminCtx = { userId: string };

async function currentAdmin(): Promise<AdminCtx | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "admin" ? { userId: user.id } : null;
}

/** For pages/layouts: redirect non-admins. */
export async function requireAdmin(): Promise<AdminCtx> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (data?.role !== "admin") redirect("/dashboard");
  return { userId: user.id };
}

/** For server actions: return null instead of redirecting. */
export async function getAdminOrNull(): Promise<AdminCtx | null> {
  return currentAdmin();
}
