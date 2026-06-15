export type CsvRow = {
  created_at: string;
  description: string | null;
  category: string;
  type: "credit" | "debit";
  amount: number;
  currency: string;
  status: string;
  counterparty: string | null;
};

const HEADERS = ["Date", "Description", "Category", "Type", "Amount", "Currency", "Status"];

function esc(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    const signed = (r.type === "debit" ? -r.amount : r.amount).toFixed(2);
    lines.push(
      [
        esc(r.created_at),
        esc(r.description ?? r.counterparty ?? ""),
        esc(r.category),
        esc(r.type),
        esc(signed),
        esc(r.currency),
        esc(r.status),
      ].join(",")
    );
  }
  return lines.join("\n");
}
