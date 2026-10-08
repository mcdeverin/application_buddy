"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../utils/supabase/server";
import { decrypt, encrypt, exchangeTokens, gmailGet } from "@/lib/gmail";
import { suggestEmail, emailText, type GmailPart } from "@/lib/email-parser";
import { readSyncWindow, writeSyncWindow, resolveSyncWindow } from "@/lib/sync-window";
import { applicationEmailQuery, classifyApplicationEmail } from "@/lib/email-filter";
import { statuses, validUuid } from "@/lib/tracker";
import type { MutationState } from "../tracker-actions";

async function authenticate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

export async function syncEmails(requestedFrom?: string): Promise<MutationState> {
  const auth = await authenticate();
  if (!auth) return { error: "Sign in again to sync Gmail." };
  try {
    const { data: connection, error } = await auth.supabase.from("email_connections").select("*").eq("user_id", auth.userId).maybeSingle();
    if (error || !connection) return { error: "Connect Gmail first. If setup is incomplete, run the email migration." };
    const window = resolveSyncWindow(readSyncWindow(connection.page_token, connection.connected_at), requestedFrom);
    let accessToken = decrypt(connection.access_token_encrypted);
    if (new Date(connection.expires_at).getTime() < Date.now() + 60000) {
      const tokens = await exchangeTokens({ grant_type: "refresh_token", refresh_token: decrypt(connection.refresh_token_encrypted) });
      accessToken = tokens.access_token;
      const { error: tokenError } = await auth.supabase.from("email_connections").update({ access_token_encrypted: encrypt(accessToken), expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }).eq("user_id", auth.userId).eq("email", connection.email).eq("connected_at", connection.connected_at);
      if (tokenError) throw new Error("Could not refresh your Gmail connection.");
    }
    const after = Math.floor(new Date(window.from).getTime() / 1000);
    const params = new URLSearchParams({ maxResults: "30", q: `after:${after} -in:spam -in:trash -in:sent ${applicationEmailQuery}` });
    if (window.next) params.set("pageToken", window.next);
    const page = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(`messages?${params}`, accessToken);
    let imported = 0;
    let skipped = 0;
    for (const message of page.messages ?? []) {
      const { data: existing, error: lookupError } = await auth.supabase.from("email_imports").select("id").eq("user_id", auth.userId).eq("mailbox_email", connection.email).eq("gmail_message_id", message.id).maybeSingle();
      if (lookupError) throw new Error("Could not check previously imported emails.");
      if (existing) continue;
      const full = await gmailGet<{ payload: GmailPart; snippet?: string; internalDate: string; threadId?: string }>(`messages/${encodeURIComponent(message.id)}?format=full`, accessToken);
      if (Number(full.internalDate) < new Date(window.from).getTime()) continue;
      const header = (name: string) => full.payload.headers?.find(h => h.name.toLowerCase() === name)?.value ?? "";
      const subject = header("subject").slice(0, 1000);
      const body = emailText(full.payload) || full.snippet || "";
      let evidence = classifyApplicationEmail(subject, body, header("from"));
      let inheritedThread = false;
      // A short reply inherits evidence only from another message in this exact Gmail thread.
      if (!evidence && /^(re:)/i.test(subject) && full.threadId) {
        const thread = await gmailGet<{ messages?: { payload: GmailPart }[] }>(`threads/${encodeURIComponent(full.threadId)}?format=full`, accessToken);
        evidence = [...(thread.messages ?? [])].reverse().map(message => {
          const headers = message.payload.headers ?? [];
          const value = (name: string) => headers.find(h => h.name.toLowerCase() === name)?.value ?? "";
          return classifyApplicationEmail(value("subject"), emailText(message.payload), value("from"));
        }).find(item => item !== null) ?? null;
        inheritedThread = !!evidence;
      }
      if (!evidence) { skipped++; continue; }
      const suggestion = suggestEmail(subject, body);
      if (evidence.kind === "confirmation") suggestion.status = "Applied";
      if (evidence.kind === "interview" && !["Rejected", "Offer", "Final"].includes(suggestion.status)) suggestion.status = "Interview";
      const { error: insertError } = await auth.supabase.from("email_imports").upsert({
        user_id: auth.userId, gmail_message_id: message.id, mailbox_email: connection.email,
        subject, sender: header("from").slice(0, 1000), excerpt: body.slice(0, 4000),
        received_at: new Date(Number(full.internalDate)).toISOString(),
        suggested_company: suggestion.company, suggested_role: suggestion.role,
        suggested_status: suggestion.status, reason: inheritedThread ? `Verified application thread: ${evidence.reason}` : evidence.reason,
      }, { onConflict: "user_id,mailbox_email,gmail_message_id", ignoreDuplicates: true });
      if (insertError) throw new Error("Could not save the review queue. Try syncing again.");
      imported++;
    }
    const { error: saveError } = await auth.supabase.from("email_connections").update({ page_token: writeSyncWindow({ from: window.from, next: page.nextPageToken ?? null }), last_synced_at: new Date().toISOString() }).eq("user_id", auth.userId).eq("email", connection.email).eq("connected_at", connection.connected_at);
    if (saveError) throw new Error("Could not save sync progress. Imported emails are safe; try again.");
    revalidatePath("/email");
    return { message: `${imported} application email${imported === 1 ? "" : "s"} added for review. ${skipped} unrelated email${skipped === 1 ? "" : "s"} skipped.${page.nextPageToken ? " Sync again to read the next batch." : ""}`, saved: Date.now() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gmail sync failed. Try again." };
  }
}

export async function acceptEmail(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticate();
  if (!auth) return { error: "Sign in again." };
  const id = String(form.get("id") ?? "");
  const company = String(form.get("company") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  const status = String(form.get("status") ?? "");
  const applicationId = String(form.get("application_id") ?? "");
  if (!validUuid(id) || (applicationId && !validUuid(applicationId))) return { error: "Invalid email or application." };
  if (!company || company.length > 200 || !role || role.length > 250 || !statuses.some(s => s === status)) return { error: "Check the company, role and stage." };
  const { error } = await auth.supabase.rpc("accept_email_update", { import_id: id, company_name: company, role_name: role, new_status: status, target_application_id: applicationId || null });
  if (error) return { error: "Could not save this update. If multiple applications share these details, select the existing application explicitly." };
  revalidatePath("/"); revalidatePath("/email");
  return { message: "Application and timeline updated.", saved: Date.now() };
}

export async function ignoreEmail(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticate();
  if (!auth) return { error: "Sign in again." };
  const id = String(form.get("id") ?? "");
  if (!validUuid(id)) return { error: "Invalid email." };
  const { data, error } = await auth.supabase.from("email_imports").update({ review_status: "ignored" }).eq("id", id).eq("user_id", auth.userId).eq("review_status", "pending").select("id").maybeSingle();
  if (error || !data) return { error: "Could not ignore this entry. Refresh and try again." };
  revalidatePath("/email");
  return { message: "Email ignored.", saved: Date.now() };
}

export async function disconnectGmail(): Promise<MutationState> {
  const auth = await authenticate();
  if (!auth) return { error: "Sign in again." };
  // Stop app access by removing its encrypted credentials; retained imports stay in your tracker.
  const { error } = await auth.supabase.from("email_connections").delete().eq("user_id", auth.userId);
  if (error) return { error: "Could not disconnect Gmail. Try again." };
  revalidatePath("/email");
  return { message: "Gmail disconnected. You can also revoke Application Buddy in your Google account permissions.", saved: Date.now() };
}
