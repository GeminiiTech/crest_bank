import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SeedButton } from "@/components/dashboard/seed-button";

export function DashboardEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">Set up your demo dashboard</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            You don&apos;t have any accounts yet. Create realistic sample accounts and
            transactions to explore the Crest Bank dashboard.
          </p>
        </div>
        <SeedButton />
      </CardContent>
    </Card>
  );
}
