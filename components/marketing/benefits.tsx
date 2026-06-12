import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/shared/motion/reveal";
import { benefits } from "@/lib/constants";

export function Benefits() {
  return (
    <section className="bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Why customers choose Crest</h2>
          <p className="mt-4 text-lg text-slate-300">A banking experience that&apos;s fast, transparent, and genuinely on your side.</p>
          <ul className="mt-8 space-y-6">
            {benefits.map((b) => (
              <li key={b.title} className="flex gap-4">
                <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-success" />
                <div>
                  <h3 className="font-display text-lg font-semibold">{b.title}</h3>
                  <p className="mt-1 text-slate-300">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="rounded-2xl border border-navy-700 bg-navy-800 p-8 shadow-card">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-navy-900 p-4">
              <span className="text-sm text-slate-300">Monthly spending</span>
              <span className="font-display text-xl font-bold">$3,120</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-navy-900"><div className="h-full w-2/3 rounded-full bg-primary" /></div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[["Housing", "42%"], ["Food", "23%"], ["Other", "35%"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-navy-900 p-3"><p className="font-display text-lg font-bold">{v}</p><p className="text-slate-400">{k}</p></div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
