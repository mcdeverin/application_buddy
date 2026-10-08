import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../utils/supabase/server";
import { readSyncWindow } from "@/lib/sync-window";
import { classifyApplicationEmail } from "@/lib/email-filter";
import { gmailConfigured } from "@/lib/gmail";
import { EmailReader } from "./reader";

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const [connection, imports, applications] = await Promise.all([
    supabase.from("email_connections").select("email, connected_at, last_synced_at, page_token").eq("user_id", data.user.id).maybeSingle(),
    supabase.from("email_imports").select("id, subject, sender, excerpt, received_at, suggested_company, suggested_role, suggested_status, reason").eq("user_id", data.user.id).eq("review_status", "pending").order("received_at", { ascending: true }).limit(500),
    supabase.from("applications").select("id, company, role").eq("user_id", data.user.id).order("company"),
  ]);
  const params = await searchParams;
  return <main className="min-h-screen bg-[#F8F8F6] px-5 py-10 text-[#171717]"><div className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-neutral-500">← Application Buddy</Link><h1 className="mt-8 text-3xl font-semibold tracking-tight">Your inbox, organized.</h1><p className="mb-8 mt-3 text-neutral-500">Read new application emails and turn them into updates.</p><EmailReader connection={connection.data ? { email: connection.data.email, connected_at: connection.data.connected_at, last_synced_at: connection.data.last_synced_at, sync_from: readSyncWindow(connection.data.page_token, connection.data.connected_at).from, has_more: !!readSyncWindow(connection.data.page_token, connection.data.connected_at).next } : null} emails={(imports.data ?? []).filter(email => classifyApplicationEmail(email.subject, email.excerpt, email.sender) || email.reason?.startsWith("Verified application thread: "))} applications={applications.data ?? []} configured={gmailConfigured()} loadError={!!(connection.error || imports.error || applications.error)} oauthStatus={params.gmail} /></div></main>;
}
