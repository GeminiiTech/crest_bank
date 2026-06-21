/** `YYYY-MM-DD` -> `YYYY-MM-DDT00:00:00.000Z`, or null if not a real calendar date. */
export function toCreatedAtISO(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  // reject rollovers like 2026-02-30 -> Mar 2
  if (
    dt.getUTCFullYear() !== Number(y) ||
    dt.getUTCMonth() + 1 !== Number(mo) ||
    dt.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${date}T00:00:00.000Z`;
}
