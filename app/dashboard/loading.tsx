export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
