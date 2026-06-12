import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/motion/reveal";

export function CtaBand() {
  return (
    <section className="bg-background pb-20 sm:pb-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-navy-900 px-8 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Open your Crest account today</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">It takes about five minutes. No paperwork, no hidden fees, no branch visit.</p>
          <Button asChild size="lg" variant="secondary" className="mt-8 bg-white text-navy-900 hover:bg-slate-100">
            <Link href="/register">Get started — it&apos;s free</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
