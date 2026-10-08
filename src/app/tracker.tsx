"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { statuses, safeJobUrl, type Application, type Task, type ApplicationEvent } from "@/lib/tracker";
import { saveApplication, saveTask, toggleTask, addEvent, type MutationState } from "./tracker-actions";

const inputClass = "w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20";
const buttonClass = "rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50";
const panelClass = "rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6";

function formatDate(value: string | null, time = false) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", ...(time ? { hour: "numeric", minute: "2-digit" } : {}) });
}
function Feedback({ state }: { state: MutationState }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.message && <p role="status" className="text-sm text-green-800">{state.message}</p>}</>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-xs font-medium text-neutral-500">{label}</span>{children}</label>;
}

function ApplicationForm({ application, onSaved }: { application?: Application; onSaved?: () => void }) {
  const [state, action, pending] = useActionState(saveApplication, {});
  useEffect(() => { if (state.saved) onSaved?.(); }, [state.saved, onSaved]);
  return <form action={action} className="space-y-4">
    {application && <input type="hidden" name="id" value={application.id} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company *"><input name="company" required maxLength={200} defaultValue={application?.company} className={inputClass} /></Field>
      <Field label="Role *"><input name="role" required maxLength={250} defaultValue={application?.role} className={inputClass} /></Field>
      <Field label="Stage"><select name="status" defaultValue={application?.status ?? "Applied"} className={inputClass}>{application && !statuses.some(s => s === application.status) && <option value={application.status} disabled>{application.status} — choose a stage</option>}{statuses.map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Location"><input name="location" maxLength={250} defaultValue={application?.location ?? ""} className={inputClass} /></Field>
      <Field label="Salary"><input name="salary" maxLength={200} defaultValue={application?.salary ?? ""} placeholder="$100,000–$120,000" className={inputClass} /></Field>
      <Field label="Applied on"><input type="date" name="applied_at" defaultValue={application?.applied_at?.slice(0, 10) ?? ""} className={inputClass} /></Field>
      <Field label="Job link"><input type="url" name="job_url" maxLength={2000} defaultValue={application?.job_url ?? ""} placeholder="https://…" className={inputClass} /></Field>
      <Field label="Source"><input name="source" maxLength={200} defaultValue={application?.source ?? ""} placeholder="LinkedIn, recruiter, company site…" className={inputClass} /></Field>
    </div>
    <Feedback state={state} />
    <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : application ? "Save changes" : "Add application"}</button>
  </form>;
}

function TaskForm({ applications }: { applications: Application[] }) {
  const [state, action, pending] = useActionState(saveTask, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.saved) form.current?.reset(); }, [state.saved]);
  return <form ref={form} action={action} className="space-y-4">
    <Field label="What needs doing? *"><input name="title" required maxLength={500} placeholder="Follow up with recruiter" className={inputClass} /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Application"><select name="application_id" className={inputClass}><option value="">General task</option>{applications.map(a => <option key={a.id} value={a.id}>{a.company} · {a.role}</option>)}</select></Field>
      <Field label="Due date and time"><input name="due_at" type="datetime-local" className={inputClass} /></Field>
    </div>
    <Feedback state={state} />
    <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Add task"}</button>
  </form>;
}

function TaskRow({ task, application }: { task: Task; application?: Application }) {
  const [state, action, pending] = useActionState(toggleTask, {});
  return <div className="border-b border-black/5 py-4 last:border-0">
    <form action={action} className="flex items-start gap-3">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="completed" value={task.completed ? "false" : "true"} />
      <button disabled={pending} aria-label={`${task.completed ? "Reopen" : "Complete"} task: ${task.title}`} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/20 text-sm disabled:opacity-50">{task.completed ? "✓" : pending ? "…" : ""}</button>
      <div><p className={`text-sm font-medium ${task.completed ? "text-neutral-400 line-through" : ""}`}>{task.title}</p><p className="mt-1 text-xs text-neutral-500">{application ? `${application.company} · ` : ""}{task.due_at ? `Due ${formatDate(task.due_at, true)}` : "No due date"}</p></div>
    </form>
    <Feedback state={state.error ? state : {}} />
  </div>;
}

function EventForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(addEvent, {});
  const [eventType, setEventType] = useState("Note");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.saved) { form.current?.reset(); } }, [state.saved]);
  return <form ref={form} action={action} className="space-y-4">
    <input type="hidden" name="application_id" value={applicationId} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Entry"><select name="event_type" value={eventType} onChange={e => setEventType(e.target.value)} className={inputClass}><option>Note</option><option>Interview</option></select></Field>
      <Field label={eventType === "Interview" ? "Interview date and time *" : "Date and time (optional)"}><input name="occurred_at" type="datetime-local" required={eventType === "Interview"} className={inputClass} /></Field>
    </div>
    <Field label={eventType === "Interview" ? "Interview details *" : "Notes *"}><textarea name="description" required maxLength={10000} rows={3} placeholder={eventType === "Interview" ? "Round, interviewer, meeting link, and prep notes…" : "Recruiter update, prep notes, or next steps…"} className={inputClass} /></Field>
    <Feedback state={state} />
    <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Add entry"}</button>
  </form>;
}

function ApplicationCard({ application, events }: { application: Application; events: ApplicationEvent[] }) {
  const url = safeJobUrl(application.job_url ?? "");
  return <details className={panelClass}>
    <summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-neutral-500">{application.company}</p><h3 className="mt-1 font-semibold">{application.role}</h3><p className="mt-2 text-xs text-neutral-500">{application.location ?? "Location not specified"}{application.salary ? ` · ${application.salary}` : ""}</p></div><span className="shrink-0 rounded-full bg-[#F2F2EF] px-3 py-1 text-xs">{application.status}</span></div><div className="mt-4 flex justify-between text-xs text-neutral-400"><span>Updated {formatDate(application.last_update_at)}</span><span>Details & notes ↓</span></div></summary>
    <div className="mt-6 space-y-7 border-t border-black/5 pt-6">
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">Open job posting ↗</a>}
      <ApplicationForm application={application} />
      <section><h4 className="mb-4 text-sm font-semibold">Timeline</h4>{events.length ? <ol className="space-y-4">{events.map(e => <li key={e.id} className="border-l-2 border-neutral-200 pl-4"><p className="text-xs text-neutral-500">{e.event_type} · {formatDate(e.occurred_at, true)}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{e.description}</p></li>)}</ol> : <p className="text-sm text-neutral-400">Add a note or interview to start your timeline.</p>}</section>
      <EventForm applicationId={application.id} />
    </div>
  </details>;
}

export function Tracker({ email, applications, tasks, events, loadError, now }: { email: string; applications: Application[]; tasks: Task[]; events: ApplicationEvent[]; loadError: boolean; now: string }) {
  const router = useRouter();
  const [view, setView] = useState("Today");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("All");
  const [showCompleted, setShowCompleted] = useState(false);
  const current = new Date(now);
  const pending = tasks.filter(t => !t.completed);
  const interviews = events.filter(e => e.event_type.toLowerCase() === "interview" && e.occurred_at && new Date(e.occurred_at) >= current && applications.some(a => a.id === e.application_id && !["Rejected", "Withdrawn"].includes(a.status))).sort((a, b) => (a.occurred_at ?? "").localeCompare(b.occurred_at ?? ""));
  const shown = applications.filter(a => (stage === "All" || a.status === stage) && `${a.company} ${a.role} ${a.location ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const active = applications.filter(a => !["Rejected", "Withdrawn", "Saved"].includes(a.status)).length;
  return <main className="min-h-screen bg-[#F8F8F6] text-[#171717]">
    <aside className="border-b border-black/5 bg-white px-5 py-5 md:fixed md:inset-y-0 md:left-0 md:flex md:w-60 md:flex-col md:border-r md:px-6 md:py-8">
      <p className="mb-6 text-lg font-semibold tracking-tight">✦ Application Buddy</p>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:block md:space-y-1">{["Today", "Applications", "Interviews", "Me"].map(label => <button key={label} onClick={() => { setView(label); setAdding(false); }} aria-current={view === label ? "page" : undefined} className={`shrink-0 rounded-xl px-3 py-2.5 text-left text-sm md:w-full ${view === label ? "bg-[#F2F2EF] font-medium" : "text-neutral-500 hover:bg-neutral-50"}`}>{label}</button>)}<Link href="/email" className="block shrink-0 rounded-xl px-3 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50">Email reader</Link></nav>
      <form action="/auth/signout" method="post" className="mt-6 md:mt-auto"><p className="mb-3 truncate text-xs text-neutral-400">{email}</p><button className="text-sm text-neutral-500 hover:text-black">Sign out</button></form>
    </aside>
    <div className="md:ml-60"><div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 md:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm text-neutral-400">{current.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="text-3xl font-semibold tracking-tight">{view === "Today" ? "Your search, at a glance." : view === "Me" ? "Your workspace" : view}</h1><p className="mt-3 text-neutral-500">{view === "Today" ? "A little progress, every day." : view === "Applications" ? "Every opportunity and its next step." : view === "Interviews" ? "Upcoming conversations and your notes." : "Your account and connected tools."}</p></div>{view !== "Me" && <button onClick={() => setAdding(!adding)} className={buttonClass}>{adding ? "Close form" : "+ Add application"}</button>}</header>
      {loadError && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Some records could not be loaded. Check your connection and table access, then <button onClick={() => router.refresh()} className="underline">retry</button>.</div>}
      {adding && <section className={`${panelClass} mb-8`}><h2 className="mb-5 font-semibold">Add an application</h2><ApplicationForm onSaved={() => setAdding(false)} /></section>}
      {view === "Today" && <>
        <div className="mb-8 grid grid-cols-3 gap-3">{[["Applications", applications.length], ["Active", active], ["Needs you", pending.length]].map(([label, count]) => <div key={label} className={panelClass}><p className="text-xs text-neutral-500">{label}</p><p className="mt-2 text-2xl font-semibold">{count}</p></div>)}</div>
        <section className={`${panelClass} mb-8`}><h2 className="mb-2 font-semibold">Needs you</h2>{pending.length ? pending.map(t => <TaskRow key={t.id} task={t} application={applications.find(a => a.id === t.application_id)} />) : <p className="py-4 text-sm text-neutral-400">You’re all caught up. Add a task below to plan your next step.</p>}<details className="mt-4 border-t border-black/5 pt-4"><summary className="cursor-pointer text-sm font-medium">+ Add a task</summary><div className="mt-4"><TaskForm applications={applications} /></div></details><button onClick={() => setShowCompleted(!showCompleted)} className="mt-5 text-xs text-neutral-500 underline">{showCompleted ? "Hide" : "Show"} completed tasks</button>{showCompleted && tasks.filter(t => t.completed).map(t => <TaskRow key={t.id} task={t} application={applications.find(a => a.id === t.application_id)} />)}</section>
        <section className="mb-8"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Recent applications</h2><button onClick={() => setView("Applications")} className="text-sm text-neutral-500">View all →</button></div><div className="space-y-4">{applications.slice(0, 4).map(a => <ApplicationCard key={a.id} application={a} events={events.filter(e => e.application_id === a.id)} />)}</div>{!applications.length && <Empty text="Your first application starts here." detail="Add a company and role above. Your updates will be saved to your account." />}</section>
      </>}
      {view === "Applications" && <><div className="mb-6 flex flex-col gap-3 sm:flex-row"><input aria-label="Search applications" placeholder="Search company, role, or location…" value={query} onChange={e => setQuery(e.target.value)} className={inputClass} /><select aria-label="Filter by stage" value={stage} onChange={e => setStage(e.target.value)} className={`${inputClass} sm:max-w-48`}><option value="All">All stages</option>{Array.from(new Set([...statuses, ...applications.map(a => a.status)])).map(s => <option key={s}>{s}</option>)}</select></div><div className="space-y-4">{shown.map(a => <ApplicationCard key={a.id} application={a} events={events.filter(e => e.application_id === a.id)} />)}</div>{!shown.length && <Empty text={applications.length ? "No applications match these filters." : "No applications yet."} detail={applications.length ? "Try another search or stage." : "Add your first opportunity to start tracking."} />}</>}
      {(view === "Today" || view === "Interviews") && <section><h2 className="mb-4 font-semibold">Upcoming interviews</h2><div className="space-y-4">{interviews.map(e => { const a = applications.find(a => a.id === e.application_id)!; return <article key={e.id} className={panelClass}><p className="text-xs text-neutral-500">{formatDate(e.occurred_at, true)}</p><h3 className="mt-2 font-semibold">{a.company} · {a.role}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-600">{e.description}</p><button onClick={() => { setQuery(a.company); setStage("All"); setView("Applications"); }} className="mt-4 text-sm underline underline-offset-4">Open application & notes →</button></article>; })}</div>{!interviews.length && <Empty text="No interviews scheduled." detail="Open an application and add an Interview entry with its date, time, and preparation notes." />}</section>}
      {view === "Me" && <div className="space-y-5"><section className={panelClass}><h2 className="font-semibold">Account</h2><p className="mt-3 text-sm text-neutral-500">{email}</p></section><section className={panelClass}><h2 className="font-semibold">Email connection</h2><p className="mt-3 text-sm text-neutral-500">Connect Gmail and review application updates from new emails.</p><Link href="/email" className="mt-4 inline-block text-sm underline">Open email reader →</Link></section><section className={panelClass}><h2 className="font-semibold">Resume & matching</h2><p className="mt-3 text-sm text-neutral-500">Resume uploads and personalized job matches are coming next.</p></section></div>}
    </div></div>
  </main>;
}
function Empty({ text, detail }: { text: string; detail: string }) {
  return <div className={`${panelClass} py-10 text-center`}><p className="font-medium">{text}</p><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500">{detail}</p></div>;
}
