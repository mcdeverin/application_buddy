import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { demoConfigured, demoCookie, validDemoSession } from '@/lib/demo-session';
import { DemoLoginForm } from './form';
export const metadata = { title: 'Explore the demo | Application Buddy', robots: { index: false, follow: false } };
export default async function DemoLogin() {
  if (validDemoSession((await cookies()).get(demoCookie)?.value, process.env.DEMO_ACCESS_CODE)) redirect('/demo');
  return <main className="flex min-h-screen items-center justify-center bg-[#F8F8F6] px-5 py-12 text-[#202522]"><div className="w-full max-w-md"><p className="mb-12 text-lg font-semibold tracking-tight">✦ Application Buddy</p><p className="text-xs font-medium uppercase tracking-[0.16em] text-[#718071]">A personal job-search workspace</p><h1 className="mt-4 text-4xl font-semibold tracking-tight">Less tracking.<br />More moving forward.</h1><p className="mt-5 leading-relaxed text-neutral-500">See how application emails become an organized search, upcoming interviews, and clear next steps.</p><DemoLoginForm configured={demoConfigured(process.env.DEMO_ACCESS_CODE)} /><div className="mt-8 rounded-xl bg-[#EDEFE7] p-4 text-sm leading-relaxed text-[#65705E]">Interactive prototype with fictional sample data. Explore the workflows without connecting an inbox.</div><p className="mt-8 text-xs text-neutral-400">Built by Macauley Deverin</p></div></main>;
}
