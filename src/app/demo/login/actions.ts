"use server";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createDemoSession, demoConfigured, demoCookie, demoSessionSeconds, validDemoCode } from '@/lib/demo-session';
export async function enterDemo(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!demoConfigured(code)) return { error: 'The demo access code has not been configured yet.' };
  if (!validDemoCode(String(form.get('code') ?? ''), code)) return { error: 'That access code does not match. Please try again.' };
  (await cookies()).set(demoCookie, createDemoSession(code!), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/demo', maxAge: demoSessionSeconds });
  redirect('/demo');
}
export async function leaveDemo() {
  (await cookies()).set(demoCookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/demo', maxAge: 0 });
  redirect('/demo/login');
}
