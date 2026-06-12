"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { navLinks } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors",
      scrolled ? "bg-navy-900/90 backdrop-blur supports-[backdrop-filter]:bg-navy-900/80 shadow-card" : "bg-transparent")}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Logo inverted />
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <Link key={l.label} href={l.href} className="text-sm font-medium text-slate-200 transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild><Link href="/register">Open account</Link></Button>
        </div>
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-navy-900 text-white border-navy-700">
            <SheetTitle className="text-white">Menu</SheetTitle>
            <div className="mt-8 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link key={l.label} href={l.href} className="rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/10">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild><Link href="/register">Open account</Link></Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
