"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { beneficiarySchema, type BeneficiaryInput } from "@/lib/validations/beneficiary";
import { createBeneficiary, updateBeneficiary, type BeneficiaryResult } from "@/app/dashboard/beneficiaries/actions";
import type { Beneficiary } from "@/lib/data/beneficiaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BeneficiaryForm({
  trigger,
  beneficiary,
}: {
  trigger: React.ReactNode;
  beneficiary?: Beneficiary;
}) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BeneficiaryInput>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: beneficiary
      ? {
          name: beneficiary.name,
          type: beneficiary.type,
          account_number: beneficiary.account_number,
          bank_name: beneficiary.bank_name ?? undefined,
          routing_number: beneficiary.routing_number ?? undefined,
          iban: beneficiary.iban ?? undefined,
        }
      : { type: "external" },
  });

  // Clear a fresh "Add" form each time it opens (avoid stale values from a prior cancel).
  useEffect(() => {
    if (open && !beneficiary) reset({ type: "external" });
  }, [open, beneficiary, reset]);

  function onSubmit(values: BeneficiaryInput) {
    setFormError(null);
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.set(k, v ?? ""));
    startTransition(async () => {
      const result: BeneficiaryResult = beneficiary
        ? await updateBeneficiary(beneficiary.id, fd)
        : await createBeneficiary(fd);
      if ("error" in result) setFormError(result.error);
      else setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{beneficiary ? "Edit beneficiary" : "Add beneficiary"}</DialogTitle>
          <DialogDescription>Saved beneficiaries can receive external transfers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          {formError && (
            <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
              {formError}
            </p>
          )}
          <div>
            <label htmlFor="bf-name" className="mb-1 block text-sm font-medium">Name</label>
            <Input id="bf-name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="bf-type" className="mb-1 block text-sm font-medium">Type</label>
            <select
              id="bf-type"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm"
              {...register("type")}
            >
              <option value="external">External (other bank)</option>
              <option value="wire">Wire</option>
              <option value="internal">Internal</option>
            </select>
          </div>
          <div>
            <label htmlFor="bf-acct" className="mb-1 block text-sm font-medium">Account number</label>
            <Input id="bf-acct" aria-invalid={!!errors.account_number} {...register("account_number")} />
            {errors.account_number && <p className="mt-1 text-xs text-rose-500">{errors.account_number.message}</p>}
          </div>
          <div>
            <label htmlFor="bf-bank" className="mb-1 block text-sm font-medium">Bank name (optional)</label>
            <Input id="bf-bank" {...register("bank_name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bf-routing" className="mb-1 block text-sm font-medium">Routing (optional)</label>
              <Input id="bf-routing" {...register("routing_number")} />
            </div>
            <div>
              <label htmlFor="bf-iban" className="mb-1 block text-sm font-medium">IBAN (optional)</label>
              <Input id="bf-iban" {...register("iban")} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : beneficiary ? "Save changes" : "Add beneficiary"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
