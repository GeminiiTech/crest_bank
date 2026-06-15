import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionQuery } from "@/lib/transactions/filters";
import { getTransactionsPage } from "@/lib/data/transactions";
import { toCsv, type CsvRow } from "@/lib/transactions/csv";

const EXPORT_CAP = 1000;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/dashboard/transactions", request.url));
  }

  const query = parseTransactionQuery(request.nextUrl.searchParams);
  const { rows } = await getTransactionsPage({ ...query, page: 1, pageSize: EXPORT_CAP });

  const csvRows: CsvRow[] = rows.map((r) => ({
    created_at: r.created_at,
    description: r.description,
    category: r.category,
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    counterparty: r.counterparty,
  }));

  return new NextResponse(toCsv(csvRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="crest-transactions.csv"',
    },
  });
}
