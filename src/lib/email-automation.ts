import { extractEmailIdentity, emailStage, messageContent } from './email-facts';
import { classifyApplicationEmail } from './email-filter';
export type MatchApplication = { id: string; company: string; role: string };
export type AutoEmail = { subject: string; excerpt: string; sender: string; reason: string; suggested_status: string; suggested_company: string; suggested_role: string };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function emailDecision(email: AutoEmail, applications: MatchApplication[], threadApplicationIds: string[] = []) {
  const evidence = classifyApplicationEmail(email.subject, email.excerpt, email.sender);
  const inherited = email.reason.startsWith('Verified application thread: ');
  if (!evidence && !inherited) return null;
  const text = `${email.subject}\n${messageContent(email.excerpt)}`;
  const { company, role } = extractEmailIdentity(email.subject, email.excerpt, email.sender);
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
  const status = emailStage(email.subject, email.excerpt, email.sender);
  const task = evidence?.kind === 'interview' && /(?:provide|share|send)[\s\S]{0,70}(?:availability|days and times)/i.test(text) ? 'Send interview availability' : evidence?.kind === 'interview' && /(?:please schedule|book(?:ing)? (?:directly|your|a)|calendly\.com)/i.test(text) ? 'Schedule interview' : null;
  return { target, company: target?.company ?? company, role: target?.role ?? role, status, task,
    canApply: !!target || (pool.length === 0 && companyMatches.length === 0 && !!company && !!role && !!status && !inherited),
    clarification: pool.length > 1 ? 'Which application does this conversation belong to?' : !company || !role ? 'We could not confidently identify the company and role.' : 'Confirm the application before saving this update.' };
}
export function gmailSourceUrl(mailbox: string, messageId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(mailbox)}#all/${encodeURIComponent(messageId)}`;
}
