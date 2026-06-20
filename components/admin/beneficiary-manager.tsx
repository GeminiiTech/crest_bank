"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { AdminBeneficiary } from "@/lib/admin/data";
import { createBeneficiaryFor, updateBeneficiaryFor, deleteBeneficiaryFor } from "@/app/admin/actions";
import { maskAccountNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm";

function Editor({ userId, beneficiary, onDone }: { userId: string; beneficiary?: AdminBeneficiary; onDone: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function save(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = beneficiary
        ? await updateBeneficiaryFor(userId, beneficiary.id, formData)
        : await createBeneficiaryFor(userId, formData);
      if ("error" in result) setMsg(result.error);
      else onDone();
    });
  }
  return (
    <form action={save} className="space-y-3 rounded-xl border bg-card p-4">
      {msg && <p className="text-xs text-rose-500">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Name" defaultValue={beneficiary?.name ?? ""} />
        <select name="type" defaultValue={beneficiary?.type ?? "external"} className={selectClass} aria-label="Type">
          <option value="external">external</option>
          <option value="wire">wire</option>
          <option value="internal">internal</option>
        </select>
        <Input name="account_number" placeholder="Account number" defaultValue={beneficiary?.account_number ?? ""} />
        <Input name="bank_name" placeholder="Bank (optional)" defaultValue={beneficiary?.bank_name ?? ""} />
        <Input name="routing_number" placeholder="Routing (optional)" defaultValue={beneficiary?.routing_number ?? ""} />
        <Input name="iban" placeholder="IBAN (optional)" defaultValue={beneficiary?.iban ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{beneficiary ? "Save" : "Add"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function BeneficiaryManager({ userId, beneficiaries }: { userId: string; beneficiaries: AdminBeneficiary[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Delete this beneficiary?")) return;
    startTransition(() => { void deleteBeneficiaryFor(userId, id); });
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <Editor userId={userId} onDone={() => setAdding(false)} />
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" /> Add beneficiary</Button>
      )}
      <div className="space-y-2">
        {beneficiaries.map((b) =>
          editingId === b.id ? (
            <Editor key={b.id} userId={userId} beneficiary={b} onDone={() => setEditingId(null)} />
          ) : (
            <div key={b.id} className="flex items-center justify-between rounded-xl border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.name} <Badge variant="secondary">{b.type}</Badge></p>
                <p className="text-xs text-muted-foreground">{b.bank_name ?? "—"} · {maskAccountNumber(b.account_number)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(b.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )
        )}
        {beneficiaries.length === 0 && <p className="text-sm text-muted-foreground">No beneficiaries.</p>}
      </div>
    </div>
  );
}
