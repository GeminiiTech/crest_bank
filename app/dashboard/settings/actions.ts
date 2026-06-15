"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, passwordSchema, notificationPrefsSchema } from "@/lib/validations/profile";

export type SettingsResult = { error: string } | { ok: true };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function updateProfile(formData: FormData): Promise<SettingsResult> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || undefined,
    country: formData.get("country") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      country: parsed.data.country || null,
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save your profile. Please try again." };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function uploadAvatar(formData: FormData): Promise<SettingsResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file." };
  if (file.size > MAX_AVATAR_BYTES) return { error: "Image must be 2 MB or smaller." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  // Derive the extension from the validated MIME type, not the client filename.
  const ext = (file.type.split("/")[1] || "png").toLowerCase().replace("jpeg", "jpg");
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: "Could not upload the image. Please try again." };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: pub.publicUrl })
    .eq("id", user.id);
  if (updateError) return { error: "Uploaded, but could not save the avatar. Please try again." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updatePassword(formData: FormData): Promise<SettingsResult> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const m = (error as { message: string }).message.toLowerCase();
    if (m.includes("should be different") || m.includes("same")) {
      return { error: "Choose a password different from your current one." };
    }
    if (m.includes("weak") || m.includes("password")) {
      return { error: "That password is too weak. Try a longer one." };
    }
    return { error: "Could not update your password. Please try again." };
  }
  return { ok: true };
}

export async function updateNotificationPrefs(formData: FormData): Promise<SettingsResult> {
  const parsed = notificationPrefsSchema.safeParse({
    product: formData.get("product") === "on" || formData.get("product") === "true",
    security: formData.get("security") === "on" || formData.get("security") === "true",
    transfers: formData.get("transfers") === "on" || formData.get("transfers") === "true",
  });
  if (!parsed.success) return { error: "Could not save preferences." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: parsed.data })
    .eq("id", user.id);
  if (error) return { error: "Could not save preferences. Please try again." };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
