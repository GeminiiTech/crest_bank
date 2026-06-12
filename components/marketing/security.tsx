import { Reveal } from "@/components/shared/motion/reveal";
import { security } from "@/lib/constants";

export function Security() {
  return (
    <section id="security" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your security is the foundation</h2>
          <p className="mt-4 text-lg text-muted-foreground">Bank-grade protection on every account, every transaction, every day.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {security.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05} className="rounded-2xl border bg-card p-7 text-center shadow-card">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-success/10 text-success"><s.icon className="h-6 w-6" /></span>
              <h3 className="mt-5 font-display text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
