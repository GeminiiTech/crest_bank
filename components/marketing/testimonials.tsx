import { Reveal } from "@/components/shared/motion/reveal";
import { testimonials } from "@/lib/constants";

export function Testimonials() {
  return (
    <section className="bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Trusted by millions</h2>
          <p className="mt-4 text-lg text-slate-300">Real stories from people and businesses that bank with Crest.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.05} className="flex flex-col rounded-2xl border border-navy-700 bg-navy-800 p-7">
              <p className="flex-1 text-slate-200">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6">
                <p className="font-display font-semibold">{t.name}</p>
                <p className="text-sm text-slate-400">{t.role}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
