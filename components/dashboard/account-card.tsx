import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, maskAccountNumber } from "@/lib/format";
import type { Account } from "@/lib/data/accounts";

const TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  current: "Current",
  business: "Business",
};

export function AccountCard({ account }: { account: Account }) {
  return (
    <Link href={`/dashboard/accounts/${account.id}`} className="block">
      <Card className="transition-shadow hover:shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {TYPE_LABEL[account.type] ?? account.type}
            </p>
            <Badge variant={account.status === "active" ? "success" : "secondary"}>
              {account.status}
            </Badge>
          </div>
          <p className="mt-4 font-display text-2xl font-bold">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {maskAccountNumber(account.account_number)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
