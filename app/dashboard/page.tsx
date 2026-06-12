import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "there";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-navy-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo inverted />
          <form action={signOut}>
            <Button type="submit" variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          You&apos;re signed in to Crest Bank. Your full dashboard — accounts, transfers,
          cards, and insights — arrives in the next release.
        </p>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-card">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="mt-1 font-medium">{user.email}</p>
        </div>
      </section>
    </main>
  );
}
