export type EmailSuggestion = { company: string; role: string; status: string; reason: string };
export function suggestEmail(subject: string, body: string): EmailSuggestion {
  const text = `${subject}\n${body}`;
  let status = "Applied";
  let reason = "Possible application confirmation; review before saving.";
  if (/not (?:be )?(?:moving|proceeding)|unfortunately|other candidates|not selected|regret to inform/i.test(text)) {
    status = "Rejected"; reason = "The email contains rejection language.";
  } else if (/offer of employment|pleased to offer|job offer|offer letter/i.test(text)) {
    status = "Offer"; reason = "The email mentions an employment offer.";
  } else if (/final (?:round|interview)/i.test(text)) {
    status = "Final"; reason = "The email mentions a final interview round.";
  } else if (/interview|schedule a (?:call|conversation)|availability|phone screen/i.test(text)) {
    status = "Interview"; reason = "The email may request or schedule an interview. Check its details.";
  } else if (/under review|reviewing your application/i.test(text)) {
    status = "Screening"; reason = "The email says the application is under review.";
  }
  const company = subject.match(/(?:application (?:to|at)|applying (?:to|at)|interest in)\s+(.+?)(?:\s[-–|:]\s|[.!]|$)/i)?.[1]?.trim() ?? "";
  const role = text.match(/(?:application for(?: the)?|applied for(?: the)?|for the)\s+([^\n.!]{3,120}?)(?:\s+(?:position|role|at)\b|[.!\n])/i)?.[1]?.trim() ?? "";
  return { company: company.slice(0, 200), role: role.slice(0, 250), status, reason };
}

export type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[]; headers?: { name: string; value: string }[] };
export function emailText(part: GmailPart): string {
  if (part.parts?.length) {
    const plain = part.parts.filter(p => p.mimeType === "text/plain");
    return (plain.length ? plain : part.parts).map(emailText).filter(Boolean).join("\n").slice(0, 20000);
  }
  if (!part.body?.data || !["text/plain", "text/html"].includes(part.mimeType ?? "")) return "";
  const text = Buffer.from(part.body.data, "base64url").toString("utf8");
  return (part.mimeType === "text/html" ? text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ") : text).slice(0, 20000);
}
