import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default function VerifyEmailPage() {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
        <MailCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-bold text-white">Check your email</h1>
      <p className="mt-2 text-sm text-slate-400">
        We&apos;ve sent a confirmation link to your inbox. Click it to activate your account,
        then log in.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}
