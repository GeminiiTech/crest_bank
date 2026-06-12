import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { NewsletterForm } from "@/components/marketing/newsletter-form";
import { footerColumns } from "@/lib/constants";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-navy-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo inverted />
            <p className="mt-4 max-w-sm text-sm text-slate-400">{site.description}</p>
            <div className="mt-6 max-w-sm">
              <p className="mb-2 text-sm font-medium text-white">Get product updates</p>
              <NewsletterForm />
            </div>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}><Link href="#" className="text-sm text-slate-400 transition-colors hover:text-white">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-navy-800 pt-8 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p className="mt-2 max-w-3xl">
            Crest Bank provides banking services through regulated partner institutions. This site is a demonstration
            project and not a real financial offering. Eligible deposits are insured up to applicable regulatory limits.
          </p>
        </div>
      </div>
    </footer>
  );
}
