import { createClient } from "@/lib/supabase/server";

export type NotificationPrefsValue = {
  product: boolean;
  security: boolean;
  transfers: boolean;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
  notification_prefs: NotificationPrefsValue;
  role: "customer" | "admin";
};

const DEFAULT_PREFS: NotificationPrefsValue = { product: true, security: true, transfers: true };

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, country, avatar_url, kyc_status, created_at, notification_prefs, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    email: user.email ?? null,
    kyc_status: (data.kyc_status as string) ?? "unverified",
    created_at: data.created_at as string,
    notification_prefs: { ...DEFAULT_PREFS, ...((data.notification_prefs as Record<string, boolean> | null) ?? {}) },
    role: (data.role as "customer" | "admin") ?? "customer",
  } as Profile;
}
