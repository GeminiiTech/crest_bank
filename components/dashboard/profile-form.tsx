"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { updateProfile } from "@/app/dashboard/settings/actions";
import type { Profile } from "@/lib/data/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? undefined,
      country: profile.country ?? undefined,
    },
  });

  function onSubmit(values: ProfileInput) {
    setMsg(null);
    const fd = new FormData();
    fd.set("full_name", values.full_name);
    fd.set("phone", values.phone ?? "");
    fd.set("country", values.country ?? "");
    startTransition(async () => {
      const result = await updateProfile(fd);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: "Profile saved." });
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
        <label htmlFor="pf-name" className="mb-1 block text-sm font-medium">Full name</label>
        <Input id="pf-name" aria-invalid={!!errors.full_name} {...register("full_name")} />
        {errors.full_name && <p className="mt-1 text-xs text-rose-500">{errors.full_name.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <Input id="pf-phone" {...register("phone")} />
        </div>
        <div>
          <label htmlFor="pf-country" className="mb-1 block text-sm font-medium">Country</label>
          <Input id="pf-country" {...register("country")} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
