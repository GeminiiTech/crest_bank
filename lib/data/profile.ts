import { createClient } from "@/lib/supabase/server";

export type NotificationPrefsValue = {
  product: boolean;
  security: boolean;
  transfers: boolean;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  notification_prefs: NotificationPrefsValue;
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
    .select("id, full_name, phone, country, avatar_url, notification_prefs")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    notification_prefs: { ...DEFAULT_PREFS, ...((data.notification_prefs as Record<string, boolean> | null) ?? {}) },
  } as Profile;
}
