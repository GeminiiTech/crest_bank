"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";

export function LoginForm({ next }: { next?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    if (next) fd.set("next", next);
    startTransition(async () => {
      const result = await signIn(fd);
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
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="bg-navy-800 border-navy-700 text-white placeholder:text-slate-500"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-200">
          Password
        </label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          className="bg-navy-800 border-navy-700 text-white placeholder:text-slate-500"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-slate-400">
        New to Crest Bank?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Open an account
        </Link>
      </p>
    </form>
  );
}
