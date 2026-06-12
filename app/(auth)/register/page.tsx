import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Open an account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-slate-400">
        Open a Crest Bank account in a few minutes.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </div>
  );
}
