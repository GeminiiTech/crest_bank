import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center bg-navy-900 px-4 py-12">
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo inverted />
        </div>
        <div className="rounded-2xl border border-navy-700 bg-navy-800/60 p-6 shadow-card sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
