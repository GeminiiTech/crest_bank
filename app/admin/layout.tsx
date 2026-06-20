import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/guard";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-navy-900 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 font-display font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Crest Admin
          </span>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
              <Link href="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to app</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
