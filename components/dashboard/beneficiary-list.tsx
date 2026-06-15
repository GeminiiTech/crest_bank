"use client";

import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Beneficiary } from "@/lib/data/beneficiaries";
import { deleteBeneficiary } from "@/app/dashboard/beneficiaries/actions";
import { maskAccountNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BeneficiaryForm } from "@/components/dashboard/beneficiary-form";

export function BeneficiaryList({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {beneficiaries.map((b) => (
        <Card key={b.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.name}</p>
                <p className="text-sm text-muted-foreground">{b.bank_name ?? "—"}</p>
              </div>
              <Badge variant="secondary">{b.type}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{maskAccountNumber(b.account_number)}</p>
            <div className="mt-4 flex gap-2">
              <BeneficiaryForm
                beneficiary={b}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete ${b.name}?`)) {
                    startTransition(() => {
                      void deleteBeneficiary(b.id);
                    });
                  }
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
