"use client";
import { useActionState } from 'react';
import { enterDemo } from './actions';
export function DemoLoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(enterDemo, {});
  return <form action={action} className="mt-8 space-y-4"><label htmlFor="demo-code" className="block text-sm font-medium">Demo access code</label><input id="demo-code" name="code" type="password" required autoComplete="current-password" maxLength={256} className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black/20" placeholder="Enter your invitation code" />{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{!configured && <p className="text-sm text-amber-800">The demo is being prepared. Please check back shortly.</p>}<button disabled={pending || !configured} className="w-full rounded-xl bg-[#202522] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Opening your workspace…' : 'Explore Application Buddy →'}</button></form>;
}
