import { extractEmailIdentity, emailStage, decodeEmailText } from "./email-facts";
export type EmailSuggestion = { company: string; role: string; status: string; reason: string };
export function suggestEmail(subject: string, body: string, sender = ""): EmailSuggestion {
  const identity = extractEmailIdentity(subject, body, sender);
  return { ...identity, status: emailStage(subject, body, sender) ?? "Applied", reason: "Extracted from the application email." };
}

export type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[]; headers?: { name: string; value: string }[] };
export function emailText(part: GmailPart): string {
  if (part.parts?.length) {
    const plain = part.parts.filter(p => p.mimeType === "text/plain");
    return (plain.length ? plain : part.parts).map(emailText).filter(Boolean).join("\n").slice(0, 20000);
  }
  if (!part.body?.data || !["text/plain", "text/html"].includes(part.mimeType ?? "")) return "";
  const text = Buffer.from(part.body.data, "base64url").toString("utf8");
  return decodeEmailText(part.mimeType === "text/html" ? text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ") : text).slice(0, 20000);
}
