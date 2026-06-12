import { Reveal } from "@/components/shared/motion/reveal";
import { features } from "@/lib/constants";

export function Features() {
  return (
    <section id="features" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to bank with confidence</h2>
          <p className="mt-4 text-lg text-muted-foreground">One platform for personal and business finance — accounts, savings, cards, lending, and investing.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05} className="group rounded-2xl border bg-card p-7 shadow-card transition-shadow hover:shadow-lg">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-6 w-6" /></span>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
