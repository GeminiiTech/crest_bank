"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { newsletterSchema, type NewsletterInput } from "@/lib/validations/newsletter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } =
    useForm<NewsletterInput>({ resolver: zodResolver(newsletterSchema) });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function onSubmit(_data: NewsletterInput) {
    // Stub: real submission wired in a later milestone.
    await new Promise((r) => setTimeout(r, 400));
    setDone(true);
    reset();
  }

  if (done) return <p className="text-sm text-success">Thanks — you&apos;re subscribed.</p>;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 sm:flex-row" noValidate>
      <div className="flex-1">
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <Input id="nl-email" type="email" placeholder="you@email.com"
          className="bg-navy-800 border-navy-700 text-white placeholder:text-slate-400"
          aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Joining…" : "Subscribe"}</Button>
    </form>
  );
}
