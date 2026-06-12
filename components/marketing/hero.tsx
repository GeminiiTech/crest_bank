import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/motion/reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 pt-28 pb-20 text-white sm:pt-32 lg:pt-40">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-navy-700 bg-navy-800 px-3 py-1 text-xs font-medium text-slate-200">
            Premium digital banking
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Banking built on <span className="text-primary">trust</span>, designed for everyone.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            Open an account in minutes. Move money instantly, grow your savings, and manage personal and business
            finances with security you can rely on — 24/7.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/register">Open an account</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
              <Link href="#features">Explore banking</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Insured deposits</span>
            <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-success" /> 256-bit encryption</span>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="hidden lg:block">
          <HeroCard />
        </Reveal>
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-card backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Total balance</p>
            <p className="mt-1 font-display text-3xl font-bold">$48,250.00</p>
          </div>
          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">+2.4%</span>
        </div>
        <div className="mt-6 rounded-xl bg-gradient-to-br from-primary to-navy-700 p-5 text-white">
          <p className="text-xs uppercase tracking-wide text-white/70">Crest Debit</p>
          <p className="mt-6 font-mono text-lg tracking-widest">•••• •••• •••• 4921</p>
          <div className="mt-4 flex justify-between text-xs text-white/80"><span>A. CUSTOMER</span><span>12/29</span></div>
        </div>
        <div className="mt-6 space-y-3">
          {[["Apple Store", "-$129.00"], ["Salary", "+$5,400.00"], ["Transfer to Sofia", "-$250.00"]].map(([t, a]) => (
            <div key={t} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{t}</span>
              <span className={a.startsWith("+") ? "text-success" : "text-slate-200"}>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
