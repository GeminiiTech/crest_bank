"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { uploadAvatar } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";

export function AvatarUploader({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = (name || "?").charAt(0).toUpperCase();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(fd);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-4">
      {avatarUrl ? (
        <Image src={avatarUrl} alt="Your profile photo" width={64} height={64} className="h-16 w-16 rounded-full object-cover" unoptimized />
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground" aria-hidden>
          {initial}
        </span>
      )}
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} aria-label="Upload profile photo" />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Uploading…" : "Upload photo"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 2 MB.</p>
        {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      </div>
    </div>
  );
}
