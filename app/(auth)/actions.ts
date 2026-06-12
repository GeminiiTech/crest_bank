"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { sanitizeNext } from "@/lib/auth/redirects";

export type ActionResult = { error: string } | void;

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please check your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if ((error as { code?: string }).code === "email_not_confirmed") {
      return { error: "Please confirm your email first — check your inbox." };
    }
    return { error: "Incorrect email or password." };
  }

  redirect(sanitizeNext(formData.get("next")?.toString()));
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    terms: formData.get("terms") === "on" || formData.get("terms") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if ((error as { code?: string }).code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
      return { error: "An account with this email already exists." };
    }
    if (msg.includes("password")) {
      return { error: "Password is too weak — use at least 8 characters." };
    }
    if ((error as { code?: string }).code === "over_email_send_rate_limit" || msg.includes("rate")) {
      return { error: "Too many attempts. Please try again shortly." };
    }
    return { error: "Could not create your account. Please try again." };
  }

  redirect("/verify-email");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
