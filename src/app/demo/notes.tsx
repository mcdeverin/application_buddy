"use client";

import { useState } from "react";

export function DemoNotes({ storageId, label, initial = "" }: { storageId: string; label: string; initial?: string }) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState("");
  const key = `application-buddy-demo-notes:${storageId}`;

  return <details className="mt-5 rounded-xl border border-black/10 bg-[#FAFAF8] p-4" onToggle={event => {
    if (!event.currentTarget.open) return;
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) setDraft(saved);
    } catch { setStatus("Browser storage is unavailable. Notes can be edited here but cannot be saved."); }
  }}>
    <summary className="cursor-pointer text-sm font-medium">{label}</summary>
    <label htmlFor={`notes-${storageId}`} className="mt-4 block text-xs text-neutral-500">Your notes</label>
    <textarea id={`notes-${storageId}`} value={draft} onChange={event => { setDraft(event.target.value); setStatus(""); }} rows={5} placeholder="Questions to ask, stories to prepare, company research, or follow-up notes…" className="mt-2 w-full rounded-xl border border-black/15 bg-white p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-black/15" />
    <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => {
      try { localStorage.setItem(key, draft); setStatus("Notes saved."); }
      catch { setStatus("Could not save notes. Please copy them before leaving this page."); }
    }} className="rounded-xl bg-[#202522] px-4 py-2 text-sm font-medium text-white">Save notes</button><p role="status" className="text-xs text-[#65705E]">{status}</p></div>
    <p className="mt-3 text-xs text-neutral-400">Demo notes stay in this browser. They are not shared with other viewers.</p>
  </details>;
}
