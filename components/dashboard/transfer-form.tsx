"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { executeTransfer } from "@/app/dashboard/transfers/actions";
import type { Account } from "@/lib/data/accounts";
import type { Beneficiary } from "@/lib/data/beneficiaries";
import { formatCurrency, maskAccountNumber } from "@/lib/format";
import { accountTypeLabel } from "@/lib/dashboard/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "internal" | "external";

export function TransferForm({
  accounts,
  beneficiaries,
}: {
  accounts: Account[];
  beneficiaries: Beneficiary[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("internal");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [beneficiaryId, setBeneficiaryId] = useState(beneficiaries[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fromAccount = useMemo(() => accounts.find((a) => a.id === fromId), [accounts, fromId]);
  const selectClass = "flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (fromAccount && amt > fromAccount.balance) {
      setError("That amount exceeds your available balance.");
      return;
    }
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("fromAccountId", fromId);
    fd.set("amount", amount);
    fd.set("reference", reference);
    if (mode === "internal") fd.set("toAccountId", toId);
    else fd.set("beneficiaryId", beneficiaryId);

    startTransition(async () => {
      const result = await executeTransfer(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess("Transfer completed.");
        setAmount("");
        setReference("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="inline-flex rounded-xl border bg-muted p-1">
        {(["internal", "external"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "internal" ? "Between my accounts" : "To a beneficiary"}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{success}</p>}

      <div>
        <label htmlFor="tf-from" className="mb-1 block text-sm font-medium">From account</label>
        <select id="tf-from" className={selectClass} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {accountTypeLabel(a.type)} {maskAccountNumber(a.account_number)} — {formatCurrency(a.balance, a.currency)}
            </option>
          ))}
        </select>
      </div>

      {mode === "internal" ? (
        <div>
          <label htmlFor="tf-to" className="mb-1 block text-sm font-medium">To account</label>
          <select id="tf-to" className={selectClass} value={toId} onChange={(e) => setToId(e.target.value)}>
            {accounts.filter((a) => a.id !== fromId).map((a) => (
              <option key={a.id} value={a.id}>
                {accountTypeLabel(a.type)} {maskAccountNumber(a.account_number)} — {formatCurrency(a.balance, a.currency)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="tf-ben" className="mb-1 block text-sm font-medium">Beneficiary</label>
          {beneficiaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No beneficiaries yet. Add one on the Beneficiaries page first.
            </p>
          ) : (
            <select id="tf-ben" className={selectClass} value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)}>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.bank_name ? `· ${b.bank_name}` : ""} {maskAccountNumber(b.account_number)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label htmlFor="tf-amount" className="mb-1 block text-sm font-medium">Amount</label>
        <Input
          id="tf-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {fromAccount && (
          <p className="mt-1 text-xs text-muted-foreground">Available: {formatCurrency(fromAccount.balance, fromAccount.currency)}</p>
        )}
      </div>

      <div>
        <label htmlFor="tf-ref" className="mb-1 block text-sm font-medium">Reference (optional)</label>
        <Input id="tf-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={140} />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={pending || accounts.length === 0 || (mode === "internal" ? accounts.length < 2 : beneficiaries.length === 0)}
      >
        {pending ? "Sending…" : "Send transfer"}
      </Button>
    </form>
  );
}
