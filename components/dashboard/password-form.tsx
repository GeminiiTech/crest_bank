"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordSchema, type PasswordInput } from "@/lib/validations/profile";
import { updatePassword } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { PasswordInput as PasswordField } from "@/components/auth/password-input";

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });

  function onSubmit(values: PasswordInput) {
    setMsg(null);
    const fd = new FormData();
    fd.set("password", values.password);
    fd.set("confirmPassword", values.confirmPassword);
    startTransition(async () => {
      const result = await updatePassword(fd);
      if ("error" in result) setMsg({ text: result.error });
      else {
        setMsg({ ok: true, text: "Password updated." });
        reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <div>
        <label htmlFor="pw-new" className="mb-1 block text-sm font-medium">New password</label>
        <PasswordField id="pw-new" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
      </div>
      <div>
        <label htmlFor="pw-confirm" className="mb-1 block text-sm font-medium">Confirm new password</label>
        <PasswordField id="pw-confirm" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="mt-1 text-xs text-rose-500">{errors.confirmPassword.message}</p>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
    </form>
  );
}
