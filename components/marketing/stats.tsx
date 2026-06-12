import { Reveal } from "@/components/shared/motion/reveal";
import { stats } from "@/lib/constants";

export function Stats() {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.05} className="rounded-2xl border bg-card p-6 text-center shadow-card">
              <p className="font-display text-3xl font-bold text-foreground sm:text-4xl">{s.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
