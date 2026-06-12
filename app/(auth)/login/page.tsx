import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-400">
        Log in to access your Crest Bank account.
      </p>
      {searchParams.error === "verification" && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          That confirmation link is invalid or has expired. Please log in or sign up again.
        </p>
      )}
      <div className="mt-6">
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
