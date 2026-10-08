"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { statuses } from "@/lib/tracker";
import { syncEmails, acceptEmail, ignoreEmail, disconnectGmail } from "./actions";
import type { MutationState } from "../tracker-actions";

export type EmailImport = { id: string; subject: string; sender: string; excerpt: string; received_at: string; suggested_company: string; suggested_role: string; suggested_status: string; reason: string };
type AppOption = { id: string; company: string; role: string };
const input = "w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20";
const button = "rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50";
function Feedback({ state }: { state: MutationState }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.message && <p role="status" className="text-sm text-green-800">{state.message}</p>}</>;
}
function ReviewCard({ email, applications }: { email: EmailImport; applications: AppOption[] }) {
  const [state, action, pending] = useActionState(acceptEmail, {});
  const [ignoreState, ignoreAction, ignoring] = useActionState(ignoreEmail, {});
  const [target, setTarget] = useState("");
  const selected = applications.find(a => a.id === target);
  return <article className="rounded-2xl border border-black/5 bg-white p-5 sm:p-6">
    <p className="break-words text-xs text-neutral-500">{email.sender} · {new Date(email.received_at).toLocaleString()}</p><h2 className="mt-2 break-words font-semibold">{email.subject || "No subject"}</h2><p className="mt-3 text-sm text-neutral-500">{email.reason}</p>
    <details className="my-5"><summary className="cursor-pointer text-sm underline underline-offset-4">Read email excerpt</summary><p className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">{email.excerpt}</p></details>
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={email.id} />
      <label className="block space-y-2"><span className="text-xs text-neutral-500">Link to an application</span><select name="application_id" value={target} onChange={e => setTarget(e.target.value)} className={input}><option value="">Find an exact match, or create a new application</option>{applications.map(a => <option key={a.id} value={a.id}>{a.company} · {a.role}</option>)}</select></label>
      <div key={target} className="grid gap-4 sm:grid-cols-2"><label className="space-y-2"><span className="text-xs text-neutral-500">Company *</span><input name="company" required maxLength={200} readOnly={!!selected} defaultValue={selected?.company ?? email.suggested_company} className={input} /></label><label className="space-y-2"><span className="text-xs text-neutral-500">Role *</span><input name="role" required maxLength={250} readOnly={!!selected} defaultValue={selected?.role ?? email.suggested_role} className={input} /></label></div>
      <label className="block space-y-2"><span className="text-xs text-neutral-500">Suggested stage — check before saving</span><select name="status" defaultValue={email.suggested_status} className={input}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
      <Feedback state={state} /><button disabled={pending || ignoring} className={button}>{pending ? "Saving…" : "Confirm update"}</button>
    </form>
    <form action={ignoreAction} className="mt-4"><input type="hidden" name="id" value={email.id} /><button disabled={pending || ignoring} className="text-sm text-neutral-500 underline">{ignoring ? "Ignoring…" : "Not a job update · Ignore"}</button><Feedback state={ignoreState} /></form>
  </article>;
}

function dateValue(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthAgo() {
  const date = new Date();
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return dateValue(date.toISOString());
}
export function EmailReader({ connection, emails, applications, configured, loadError, oauthStatus }: { connection: { email: string; connected_at: string; last_synced_at: string | null; sync_from: string; has_more: boolean } | null; emails: EmailImport[]; applications: AppOption[]; configured: boolean; loadError: boolean; oauthStatus?: string }) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [state, setState] = useState<MutationState>({});
  const [pending, startTransition] = useTransition();
  const selectedDate = fromDate ?? (connection ? dateValue(connection.sync_from) : "");
  function syncSelectedDate() {
    const requested = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
    return syncEmails(requested);
  }
  function run(action: () => Promise<MutationState>) { startTransition(async () => { try { setState(await action()); router.refresh(); } catch { setState({ error: "Unable to complete this request. Try again." }); } }); }
  return <div className="space-y-6">
    {oauthStatus && <p role="status" className="rounded-xl bg-white p-4 text-sm">{oauthStatus === "connected" ? "Gmail connected. New emails will be available to sync." : oauthStatus === "cancelled" ? "Connection cancelled. Your inbox was not connected." : "Gmail could not be connected. Check setup and try again."}</p>}
    <section className="space-y-4 rounded-2xl border border-black/5 bg-white p-6"><h2 className="font-semibold">Gmail connection</h2>{connection ? <><p className="text-sm text-neutral-600">Connected: {connection.email}</p><p className="text-xs text-neutral-400">Reading emails received since {new Date(connection.sync_from).toLocaleString()}. {connection.last_synced_at ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}.` : "Not synced yet."}</p><div className="flex flex-wrap items-end gap-3"><label className="space-y-2"><span className="block text-xs text-neutral-500">Sync emails from</span><input type="date" value={selectedDate} max={dateValue(new Date().toISOString())} disabled={pending} onChange={e => setFromDate(e.target.value || null)} className={input} /></label><button disabled={pending} onClick={() => setFromDate(monthAgo())} className="rounded-xl border border-black/15 px-3 py-2.5 text-sm">One month ago</button></div><p className="text-xs text-neutral-500">Older job-related emails join this review queue. Already imported emails are skipped.</p><div className="flex flex-wrap items-center gap-4"><button disabled={pending || !selectedDate} onClick={() => run(syncSelectedDate)} className={button}>{pending ? "Working…" : connection.has_more && (!fromDate || selectedDate === dateValue(connection.sync_from)) ? "Sync next batch" : "Sync emails"}</button><button disabled={pending} onClick={() => run(disconnectGmail)} className="text-sm text-neutral-500 underline">Disconnect Gmail</button></div></> : <><p className="text-sm leading-relaxed text-neutral-500">Connect Gmail to find application confirmations, interview messages and hiring updates. Google grants read access to your mailbox; Application Buddy searches for job-related emails and stores excerpts for review. It cannot send or delete messages.</p>{configured && !loadError ? <a href="/auth/gmail/connect" className={`${button} inline-block`}>Connect Gmail</a> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Finish Google OAuth setup and run the email reader database migration to enable this connection.</p>}</>}<Feedback state={state} /></section>
    {loadError && <p role="alert" className="text-sm text-red-700">The email reader tables could not be loaded. Run the supplied migration and check your connection.</p>}
    <div><h2 className="font-semibold">Review updates <span className="text-neutral-400">({emails.length})</span></h2><p className="mt-2 text-sm text-neutral-500">Suggestions use text rules and can be wrong. Confirm the application and stage before saving. Interview dates remain in the email excerpt until you add them to the application.</p></div>
    {emails.length ? emails.map(email => <ReviewCard key={email.id} email={email} applications={applications} />) : <div className="rounded-2xl border border-black/5 bg-white p-10 text-center"><p className="font-medium">No emails waiting for review.</p><p className="mt-2 text-sm text-neutral-500">Once connected, sync after a new application confirmation or recruiter email arrives.</p></div>}
    {emails.length === 100 && <p className="text-sm text-neutral-500">Showing the oldest 100 pending emails. Review these to see the next entries.</p>}
  </div>;
}
