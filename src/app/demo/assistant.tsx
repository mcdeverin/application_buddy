"use client";

import { useState } from "react";
import { demoDate, type DemoData } from "@/lib/demo-data";

const profiles: Record<string, string> = {
  northstar: "Fictional company profile: Northstar Studio builds collaboration software for creative teams. Its product operations role focuses on launch planning, customer feedback, and cross-functional coordination.",
  harbor: "Fictional company profile: Harbor Labs builds workflow software for business teams. Its business operations role focuses on scalable processes, operating metrics, and leadership coordination.",
  lumen: "Fictional company profile: Lumen Health builds tools for care-team coordination. Its product operations role focuses on onboarding, feedback, and reliable team workflows.",
};
type Message = { role: "user" | "assistant"; text: string };
type Offer = { base: string; bonus: string; equity: string; flexibility: string };
const inputStyle = "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm";

export function DemoAssistant({ data }: { data: DemoData }) {
  const [companyId, setCompanyId] = useState("northstar");
  const [otherId, setOtherId] = useState("harbor");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [compare, setCompare] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([
    { base: "145000", bonus: "10", equity: "Options; value and vesting unconfirmed", flexibility: "Hybrid, 3 days in office" },
    { base: "135000", bonus: "15", equity: "No equity specified", flexibility: "Remote" },
  ]);
  const company = data.applications.find(app => app.id === companyId)!;
  const other = data.applications.find(app => app.id === otherId)!;
  const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  const validOffers = offers.every(offer => offer.base.trim() && offer.bonus.trim() && Number.isFinite(Number(offer.base)) && Number(offer.base) >= 0 && Number.isFinite(Number(offer.bonus)) && Number(offer.bonus) >= 0 && Number(offer.bonus) <= 100);
  function ask(text: string) {
    if (!text.trim()) return;
    const q = text.toLowerCase();
    let answer: string;
    if (/compar|offer|salary|compensation/.test(q)) {
      setCompare(true);
      answer = "Use the sample offer comparison below. Choose two companies and edit their illustrative terms. These are hypothetical offers, not offers received by the sample candidate. Bonus amounts are targets; equity is not included in cash totals.";
    } else if (/prep|interview|question|ask/.test(q)) {
      const interview = data.interviews.find(item => item.applicationId === companyId);
      answer = `For ${company.company}'s ${company.role} role, prepare a concrete story about improving a workflow, one about aligning stakeholders, and one about measuring results.\n\nQuestions to ask:\n• What would success look like in the first 90 days?\n• Where do handoffs slow the team down today?\n• Which decisions would this role own?${interview ? `\n\nYour sample interview: ${interview.round}, ${demoDate(interview.at)}.\nPreparation context: ${interview.notes}` : "\n\nNo interview is scheduled for this application in the sample tracker."}`;
    } else if (/status|stage|timeline|next/.test(q)) {
      const tasks = data.tasks.filter(task => task.applicationId === companyId && !task.completed);
      answer = `${company.company}: ${company.stage}.\n${company.timeline.at(-1)?.detail ?? "No additional timeline detail."}\n\nNext steps: ${tasks.length ? tasks.map(task => task.title).join("; ") : "No open task recorded for this application."}`;
    } else if (/company|business|research|about|does|culture/.test(q)) {
      answer = `${profiles[companyId] ?? `There is no fictional company research profile for ${company.company} yet. The sample tracker records a ${company.role} role in ${company.location}.`}\n\nTo evaluate the opportunity, ask about the team's priorities, decision-making, and expectations for this role. This demo does not browse the web or verify real company facts.`;
    } else {
      answer = `This sample assistant supports company overviews, interview preparation, application status, and offer comparisons. Try “What should I ask in my interview?” or choose a prompt below. It does not use a live language model.`;
    }
    try {
      const notes = localStorage.getItem(`application-buddy-demo-notes:company-${company.company.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
      if (notes?.trim()) answer += `\n\nYour saved company notes:\n${notes}`;
    } catch { /* Notes are optional when browser storage is unavailable. */ }
    setMessages(value => [...value, { role: "user", text: `${company.company}: ${text.trim()}` }, { role: "assistant", text: answer }]);
    setQuestion("");
  }
  return <section className="space-y-5">
    <div className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Search assistant</h2>
      <p className="mt-2 text-sm text-neutral-500">Sample responses from fictional profiles and your demo tracker. No live AI or web research is connected.</p>
      <label htmlFor="assistant-company" className="mt-5 block text-sm font-medium">Company context</label>
      <select id="assistant-company" value={companyId} onChange={event => setCompanyId(event.target.value)} className={`${inputStyle} mt-2`}>{data.applications.map(app => <option key={app.id} value={app.id}>{app.company}</option>)}</select>
      <div className="mt-4 flex flex-wrap gap-2">{["Tell me about this company", "Help me prepare for my interview", "What is my next step?", "Compare sample offers"].map(prompt => <button key={prompt} onClick={() => ask(prompt)} className="rounded-full border border-black/10 px-3 py-2 text-xs hover:bg-[#EDF0E8]">{prompt}</button>)}</div>
      <div aria-live="polite" className="mt-5 space-y-4">{messages.map((message, index) => <div key={index} className={`rounded-xl p-4 ${message.role === "user" ? "bg-neutral-50" : "bg-[#EDF0E8]"}`}><p className="mb-2 text-xs font-medium text-[#65705E]">{message.role === "user" ? "You" : "Sample assistant"}</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p></div>)}</div>
      <form onSubmit={event => { event.preventDefault(); ask(question); }} className="mt-5 flex gap-2"><input aria-label="Ask the sample assistant" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about the selected company…" className={inputStyle}/><button disabled={!question.trim()} className="rounded-xl bg-[#202522] px-4 py-2 text-sm text-white disabled:opacity-40">Ask</button></form>
    </div>
    {compare && <div className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Compare hypothetical offers</h2><p className="mt-2 text-sm text-neutral-500">Illustrative USD terms. Edit these to explore tradeoffs; they do not change application stages.</p>
      <label htmlFor="compare-company" className="mt-5 block text-sm">Compare {company.company} with</label><select id="compare-company" value={otherId} onChange={event => setOtherId(event.target.value)} className={`${inputStyle} mt-2`}>{data.applications.filter(app => app.id !== companyId).map(app => <option key={app.id} value={app.id}>{app.company}</option>)}</select>
      {companyId === otherId ? <p className="mt-4 text-sm">Choose two different companies to compare.</p> : <>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">{offers.map((offer, index) => <fieldset key={index} className="space-y-3 rounded-xl border border-black/10 p-4"><legend className="px-2 text-sm font-semibold">{index === 0 ? company.company : other.company}</legend>{([['base','Annual base salary (USD)'],['bonus','Target bonus (%)'],['equity','Equity details'],['flexibility','Work arrangement']] as const).map(([field,label]) => <label key={field} className="block text-xs text-neutral-500">{label}<input aria-label={`${index === 0 ? company.company : other.company} ${label}`} type={field === 'base' || field === 'bonus' ? 'number' : 'text'} min={field === 'base' || field === 'bonus' ? 0 : undefined} max={field === 'bonus' ? 100 : undefined} value={offer[field]} onChange={event => setOffers(value => value.map((item,i) => i === index ? {...item,[field]:event.target.value} : item))} className={`${inputStyle} mt-1`}/></label>)}</fieldset>)}</div>
        {!validOffers ? <p role="alert" className="mt-4 text-sm text-red-700">Enter nonnegative salaries and bonus percentages between 0 and 100.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-medium">Cash and working-style comparison</caption><thead><tr><th className="p-2">Term</th><th className="p-2">{company.company}</th><th className="p-2">{other.company}</th></tr></thead><tbody>{[ ['Base salary', ...offers.map(offer => money(Number(offer.base)))], ['Target bonus', ...offers.map(offer => money(Number(offer.base)*Number(offer.bonus)/100))], ['Cash at target', ...offers.map(offer => money(Number(offer.base)*(1+Number(offer.bonus)/100)))], ['Equity (not cash)', ...offers.map(offer => offer.equity)], ['Work arrangement', ...offers.map(offer => offer.flexibility)] ].map(row => <tr key={row[0]} className="border-t border-black/10">{row.map((cell,index) => index === 0 ? <th key={index} className="p-2 font-medium">{cell}</th> : <td key={index} className="p-2">{cell}</td>)}</tr>)}</tbody></table><p className="mt-4 text-xs leading-relaxed text-neutral-500">Target bonuses are not guaranteed. Compare benefits, commute costs, equity vesting, manager fit, and growth before deciding. The demo does not select a winner for you.</p></div>}
      </>}
    </div>}
  </section>;
}
