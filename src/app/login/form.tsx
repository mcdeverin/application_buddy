"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-black/20" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required className="w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-black/20" />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-green-800">{state.message}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <button type="button" disabled={pending} onClick={() => setMode(mode === "login" ? "signup" : "login")} className="w-full text-sm text-neutral-600 underline underline-offset-4">
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
