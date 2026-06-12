"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { signUp } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";

const fieldClass = "bg-navy-800 border-navy-700 text-white placeholder:text-slate-500";

export function RegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  function onSubmit(values: RegisterInput) {
    setFormError(null);
    const fd = new FormData();
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("confirmPassword", values.confirmPassword);
    fd.set("terms", values.terms ? "true" : "false");
    startTransition(async () => {
      const result = await signUp(fd);
      if (result?.error) setFormError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {formError}
        </p>
      )}
      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-200">
          Full name
        </label>
        <Input id="fullName" autoComplete="name" className={fieldClass}
          aria-invalid={!!errors.fullName} {...register("fullName")} />
        {errors.fullName && <p className="mt-1 text-xs text-rose-400">{errors.fullName.message}</p>}
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
          Email
        </label>
        <Input id="email" type="email" autoComplete="email" className={fieldClass}
          aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-200">
          Password
        </label>
        <PasswordInput id="password" autoComplete="new-password" className={fieldClass}
          aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-200">
          Confirm password
        </label>
        <PasswordInput id="confirmPassword" autoComplete="new-password" className={fieldClass}
          aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-rose-400">{errors.confirmPassword.message}</p>
        )}
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-navy-700 bg-navy-800"
            aria-invalid={!!errors.terms} {...register("terms")} />
          <span>
            I agree to the{" "}
            <Link href="#" className="text-primary hover:underline">Terms of Service</Link> and{" "}
            <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        {errors.terms && <p className="mt-1 text-xs text-rose-400">{errors.terms.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
