export default function AccountsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
