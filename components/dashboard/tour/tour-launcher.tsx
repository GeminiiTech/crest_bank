"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/dashboard/tour/tour-provider";

export function TourLauncher() {
  const { start } = useTour();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={start}
      aria-label="Take the tour"
      className="text-slate-200 hover:bg-white/10 hover:text-white"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
