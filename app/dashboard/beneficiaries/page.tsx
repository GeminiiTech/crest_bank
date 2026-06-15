import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getBeneficiaries } from "@/lib/data/beneficiaries";
import { BeneficiaryForm } from "@/components/dashboard/beneficiary-form";
import { BeneficiaryList } from "@/components/dashboard/beneficiary-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage() {
  const beneficiaries = await getBeneficiaries();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Beneficiaries</h1>
        <BeneficiaryForm
          trigger={
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Add beneficiary
            </Button>
          }
        />
      </div>
      {beneficiaries.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center text-sm text-muted-foreground">
            No beneficiaries yet. Add one to start sending external transfers.
          </CardContent>
        </Card>
      ) : (
        <BeneficiaryList beneficiaries={beneficiaries} />
      )}
    </div>
  );
}
