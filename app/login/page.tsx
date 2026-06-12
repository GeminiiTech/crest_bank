import Link from "next/link";
export const metadata = { title: "Log in" };
export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-navy-900 px-4 text-center text-white">
      <div>
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-3 text-slate-300">Authentication ships in Milestone 2.</p>
        <Link href="/" className="mt-6 inline-block text-primary underline">Back to home</Link>
      </div>
    </main>
  );
}
