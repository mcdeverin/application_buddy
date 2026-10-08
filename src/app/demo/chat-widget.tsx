"use client";

import { useEffect, useRef, useState } from "react";
import { DemoAssistant } from "./assistant";
import type { DemoData } from "@/lib/demo-data";

export function DemoChatWidget({ data, contextId }: { data: DemoData; contextId?: string }) {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); launcher.current?.focus(); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  return <div className="fixed bottom-5 right-4 z-40 sm:right-6">
    <section id="buddy-chat" role="dialog" aria-label="Application Buddy sample chat" hidden={!open} className={`${open ? "flex" : "hidden"} mb-3 max-h-[calc(100dvh-7rem)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#F8F8F6] shadow-2xl`}>
      <header className="flex shrink-0 items-center justify-between gap-3 bg-[#202522] px-4 py-3 text-white"><div><h2 className="text-sm font-semibold">✦ Application Buddy</h2><p className="mt-1 text-xs text-white/70">Your search assistant · Sample demo</p></div><button ref={close} aria-label="Close chat" onClick={() => { setOpen(false); launcher.current?.focus(); }} className="rounded-lg px-2 py-1 text-xl hover:bg-white/10">×</button></header>
      <div className="overflow-y-auto overscroll-contain p-3"><DemoAssistant data={data} contextId={contextId}/></div>
    </section>
    <div className="flex justify-end"><button ref={launcher} aria-expanded={open} aria-controls="buddy-chat" onClick={() => setOpen(value => !value)} className="rounded-full bg-[#202522] px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-[#3E4940]">{open ? 'Close chat' : '✦ Ask Buddy'}</button></div>
  </div>;
}
