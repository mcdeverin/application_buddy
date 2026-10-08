import { classifyApplicationEmail } from './email-filter';
export type MatchApplication = { id: string; company: string; role: string };
export type AutoEmail = { subject: string; excerpt: string; sender: string; reason: string; suggested_status: string; suggested_company: string; suggested_role: string };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function clean(value: string) { return value.trim().replace(/[.!]+$/, '').trim(); }
export function emailDecision(email: AutoEmail, applications: MatchApplication[], threadApplicationIds: string[] = []) {
  const evidence = classifyApplicationEmail(email.subject, email.excerpt, email.sender);
  const inherited = email.reason.startsWith('Verified application thread: ');
  if (!evidence && !inherited) return null;
  const text = `${email.subject}\n${email.excerpt.split(/On .+wrote:|From:|unsubscribe|NOTICE:|Disclaimer/i)[0]}`;
  const company = clean(text.match(/(?:application to|application at|applying to|interest in joining)\s+([^\n.!]{2,100}?)(?=\s+(?:for the|for a|for an|for)\b|\s+[-–|]|[\n.!]|$)/i)?.[1] ?? text.match(/(?:role|position)\s+(?:open\s+)?(?:with|at)\s+([^\n.!]{2,100})/i)?.[1] ?? email.suggested_company);
  const role = clean(text.match(/(?:for the|for an?|application for(?: the)?)\s+([^\n.!]{3,120}?)\s+(?:role|position)(?:\b)/i)?.[1] ?? email.suggested_role);
  const exact = applications.filter(a => company && role && normalize(a.company) === normalize(company) && normalize(a.role) === normalize(role));
  const companyMatches = applications.filter(a => company && normalize(a.company) === normalize(company));
  const mentions = applications.filter(a => {
    const companyWords = normalize(a.company);
    // A full company name in the content, or its exact corporate sender domain.
    const domain = email.sender.match(/@([^>\s]+)/)?.[1]?.toLowerCase().replace(/^(?:mail|jobs|careers)\./,'').split('.')[0];
    return companyWords.length >= 4 && (new RegExp(`\\b${companyWords.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(normalize(text)) || domain === companyWords.replace(/ /g,'')) && (!role || normalize(a.role) === normalize(role));
  });
  const threadMatches = applications.filter(a => threadApplicationIds.includes(a.id));
  const pool = threadMatches.length ? threadMatches : exact.length ? exact : companyMatches.length && !role ? companyMatches : mentions;
  const target = pool.length === 1 ? pool[0] : null;
  // Only explicit decisions set stages. Ordinary replies preserve the existing stage.
  let status: string | null = null;
  if (evidence?.kind === 'confirmation') status = 'Applied';
  else if (evidence?.kind === 'offer') status = 'Offer';
  else if (/not (?:be )?(?:moving|proceeding) (?:forward|ahead)|not (?:been )?selected|regret to inform|decided (?:not to|to (?:pursue|move forward with) other)|unfortunately[\s\S]{0,150}(?:application|role|position|move forward)/i.test(text)) status = 'Rejected';
  else if (evidence?.kind === 'interview' && /final (?:round|interview)/i.test(text)) status = 'Final';
  else if (evidence?.kind === 'interview' && /(?:schedule|confirm|invite|availability|interviewing|next (?:stage|round)|interview details)/i.test(text)) status = 'Interview';
  else if (/your application[\s\S]{0,30}(?:under review|being reviewed)/i.test(text)) status = 'Screening';
  const task = evidence?.kind === 'interview' && /(?:provide|share|send)[\s\S]{0,70}(?:availability|days and times)/i.test(text) ? 'Send interview availability' : evidence?.kind === 'interview' && /(?:please schedule|book(?:ing)? (?:directly|your|a)|calendly\.com)/i.test(text) ? 'Schedule interview' : null;
  return { target, company: target?.company ?? company, role: target?.role ?? role, status, task,
    canApply: !!target || (pool.length === 0 && companyMatches.length === 0 && !!company && !!role && !!status && !inherited),
    clarification: pool.length > 1 ? 'Which application does this conversation belong to?' : !company || !role ? 'We could not confidently identify the company and role.' : 'Confirm the application before saving this update.' };
}
export function gmailSourceUrl(mailbox: string, messageId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(mailbox)}#all/${encodeURIComponent(messageId)}`;
}
