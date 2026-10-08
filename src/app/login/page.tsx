import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { LoginForm } from "./form";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect("/");
  }
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F8F6] px-6 py-12 text-[#171717]">
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
        <p className="mb-10 text-lg font-semibold">✦ Application Buddy</p>
        <h1 className="text-3xl font-semibold tracking-tight">Your search, together.</h1>
        <p className="mb-8 mt-3 text-sm leading-relaxed text-neutral-500">Sign in to your personal job search workspace.</p>
        {error && <p role="alert" className="mb-5 text-sm text-red-700">Your confirmation link could not be verified. Try signing in or request a new confirmation email.</p>}
        {configured ? <LoginForm /> : <p role="alert" className="text-sm text-neutral-600">Add your Supabase URL and publishable key to .env.local, then restart the app to enable sign in.</p>}
      </div>
    </main>
  );
}
