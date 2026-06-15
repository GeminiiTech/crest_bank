export type TransactionQuery = {
  accountId?: string;
  type?: "credit" | "debit";
  category?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function toPositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parseTransactionQuery(params: ParamSource): TransactionQuery {
  const type = read(params, "type");
  const isoDate = (v: string | undefined) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  const page = Math.max(1, toPositiveInt(read(params, "page"), 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toPositiveInt(read(params, "pageSize"), DEFAULT_PAGE_SIZE)));

  return {
    accountId: read(params, "accountId") || undefined,
    type: type === "credit" || type === "debit" ? type : undefined,
    category: read(params, "category") || undefined,
    search: read(params, "search")?.trim() || undefined,
    from: isoDate(read(params, "from")),
    to: isoDate(read(params, "to")),
    page,
    pageSize,
  };
}
