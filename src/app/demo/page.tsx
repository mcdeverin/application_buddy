import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { demoCookie, validDemoSession } from '@/lib/demo-session';
import { createDemoData } from '@/lib/demo-data';
import { DemoWorkspace } from './workspace';
export const metadata = { title: 'Demo workspace | Application Buddy', robots: { index: false, follow: false } };
export default async function DemoPage() {
  if (!validDemoSession((await cookies()).get(demoCookie)?.value, process.env.DEMO_ACCESS_CODE)) redirect('/demo/login');
  return <DemoWorkspace initial={createDemoData()} />;
}
