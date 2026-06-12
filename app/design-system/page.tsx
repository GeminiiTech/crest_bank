import type { Metadata } from "next";
export const metadata: Metadata = { title: "Design System", robots: { index: false, follow: false } };

const swatches = [
  ["Navy 950", "bg-navy-950"], ["Navy 900", "bg-navy-900"], ["Navy 800", "bg-navy-800"],
  ["Primary", "bg-primary"], ["Success", "bg-success"], ["Destructive", "bg-destructive"],
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl font-bold">Crest Bank Design System</h1>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Color</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {swatches.map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-xl border">
              <div className={`h-20 ${cls}`} />
              <p className="p-3 text-sm font-medium">{name}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Typography</h2>
        <div className="mt-4 space-y-3">
          <p className="font-display text-5xl font-bold">Display 5xl</p>
          <p className="font-display text-3xl font-bold">Heading 3xl</p>
          <p className="text-lg">Body large — Inter regular.</p>
          <p className="text-sm text-muted-foreground">Muted small text.</p>
        </div>
      </section>
    </main>
  );
}
