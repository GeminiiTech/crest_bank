"use client";

import { useState, useTransition } from "react";
import { seedDemoData } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function SeedButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await seedDemoData();
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Setting up…" : "Set up demo data"}
      </Button>
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  );
}
