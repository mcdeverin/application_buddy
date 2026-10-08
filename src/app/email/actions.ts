"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../utils/supabase/server";
import { decrypt, encrypt, exchangeTokens, gmailGet } from "@/lib/gmail";
import { suggestEmail, emailText, type GmailPart } from "@/lib/email-parser";
import { readSyncWindow, writeSyncWindow, resolveSyncWindow } from "@/lib/sync-window";
import { applicationEmailQuery, classifyApplicationEmail } from "@/lib/email-filter";
import { GmailError, readGmailPage, readOptionalGmail, readWithRefresh } from "@/lib/gmail-request";
import { emailDecision } from "@/lib/email-automation";
import { statuses, validUuid } from "@/lib/tracker";
import type { MutationState } from "../tracker-actions";

async function authenticate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

export async function syncEmails(requestedFrom?: string, pendingOnly = false): Promise<MutationState & { hasMore?: boolean; pendingOnly?: boolean; applied?: number; clarifications?: number }> {
  const auth = await authenticate();
  if (!auth) return { error: "Sign in again to sync Gmail." };
  try {
    if (pendingOnly) {
      const automatic = await processPending(auth);
      revalidatePath("/"); revalidatePath("/email");
      return { applied: automatic.applied, clarifications: automatic.clarifications, hasMore: automatic.more, pendingOnly: true, message: `${automatic.applied} automatic updates; ${automatic.clarifications} need clarification.` };
    }
    const { data: connection, error } = await auth.supabase.from("email_connections").select("*").eq("user_id", auth.userId).maybeSingle();
    if (error || !connection) return { error: "Connect Gmail first. If setup is incomplete, run the email migration." };
    const window = resolveSyncWindow(readSyncWindow(connection.page_token, connection.connected_at), requestedFrom);
    let accessToken = decrypt(connection.access_token_encrypted);
    let refreshed = false;
    const refreshAccess = async () => {
      if (refreshed) throw new GmailError(401, "authError", "read emails");
      const tokens = await exchangeTokens({ grant_type: "refresh_token", refresh_token: decrypt(connection.refresh_token_encrypted) });
      accessToken = tokens.access_token;
      const { error: tokenError } = await auth.supabase.from("email_connections").update({ access_token_encrypted: encrypt(accessToken), expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }).eq("user_id", auth.userId).eq("email", connection.email).eq("connected_at", connection.connected_at);
      if (tokenError) throw new Error("Could not refresh your Gmail connection.");
      refreshed = true;
    };
    if (new Date(connection.expires_at).getTime() < Date.now() + 60000) await refreshAccess();
    const request = <T,>(path: string) => readWithRefresh(() => gmailGet<T>(path, accessToken), refreshAccess);
    const after = Math.floor(new Date(window.from).getTime() / 1000);
    const params = new URLSearchParams({ maxResults: "30", q: `after:${after} -in:spam -in:trash -in:sent ${applicationEmailQuery}` });
    if (window.next) params.set("pageToken", window.next);
    const page = await readGmailPage(params, path => request<{ messages?: { id: string }[]; nextPageToken?: string }>(path), async () => {
      window.next = null;
      const { error: resetError } = await auth.supabase.from("email_connections").update({ page_token: writeSyncWindow(window) }).eq("user_id", auth.userId).eq("email", connection.email).eq("connected_at", connection.connected_at);
      if (resetError) throw new Error("Could not recover sync progress. Try syncing again.");
    });
    let imported = 0;
    let skipped = 0;
    for (const message of page.messages ?? []) {
      const { data: existing, error: lookupError } = await auth.supabase.from("email_imports").select("id").eq("user_id", auth.userId).eq("mailbox_email", connection.email).eq("gmail_message_id", message.id).maybeSingle();
      if (lookupError) throw new Error("Could not check previously imported emails.");
      if (existing) continue;
      const full = await readOptionalGmail(() => request<{ payload: GmailPart; snippet?: string; internalDate: string; threadId?: string }>(`messages/${encodeURIComponent(message.id)}?format=full`));
      if (!full) { skipped++; continue; }
      if (Number(full.internalDate) < new Date(window.from).getTime()) continue;
      const header = (name: string) => full.payload.headers?.find(h => h.name.toLowerCase() === name)?.value ?? "";
      const subject = header("subject").slice(0, 1000);
      const body = emailText(full.payload) || full.snippet || "";
      let evidence = classifyApplicationEmail(subject, body, header("from"));
      let inheritedThread = false;
      // A short reply inherits evidence only from another message in this exact Gmail thread.
      if (!evidence && /^(re:)/i.test(subject) && full.threadId) {
        const thread = await readOptionalGmail(() => request<{ messages?: { payload: GmailPart }[] }>(`threads/${encodeURIComponent(full.threadId!)}?format=full`));
        evidence = [...(thread?.messages ?? [])].reverse().map(message => {
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
        gmail_thread_id: full.threadId ?? null, suggested_status: suggestion.status, reason: inheritedThread ? `Verified application thread: ${evidence.reason}` : evidence.reason,
      }, { onConflict: "user_id,mailbox_email,gmail_message_id", ignoreDuplicates: true });
      if (insertError) throw new Error("Could not save the review queue. Try syncing again.");
      imported++;
    }
    const { error: saveError } = await auth.supabase.from("email_connections").update({ page_token: writeSyncWindow({ from: window.from, next: page.nextPageToken ?? null }), last_synced_at: new Date().toISOString() }).eq("user_id", auth.userId).eq("email", connection.email).eq("connected_at", connection.connected_at);
    if (saveError) throw new Error("Could not save sync progress. Imported emails are safe; try again.");
    const automatic = await processPending(auth);
    revalidatePath("/"); revalidatePath("/email");
    return { applied: automatic.applied, clarifications: automatic.clarifications, pendingOnly: !page.nextPageToken && automatic.more, hasMore: !!page.nextPageToken || automatic.more, message: `${automatic.applied} automatic update${automatic.applied === 1 ? "" : "s"}; ${automatic.clarifications} need clarification. ${imported} application email${imported === 1 ? "" : "s"} found. ${skipped} unrelated email${skipped === 1 ? "" : "s"} skipped.`, saved: Date.now() };
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
  const { data: appliedId, error } = await auth.supabase.rpc("accept_email_update", { import_id: id, company_name: company, role_name: role, new_status: status, target_application_id: applicationId || null });
  if (error || !appliedId) return { error: "Could not save this update. If multiple applications share these details, select the existing application explicitly." };
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

async function processPending(auth: NonNullable<Awaited<ReturnType<typeof authenticate>>>) {
  const { data: pending, error } = await auth.supabase.from("email_imports").select("*").eq("user_id", auth.userId).eq("review_status", "pending").eq("automation_checked", false).order("received_at").limit(31);
  if (error) throw new Error("Run the automatic email updates migration before syncing.");
  let applied = 0, clarifications = 0;
  for (const email of (pending ?? []).slice(0, 30)) {
    const [apps, thread] = await Promise.all([
      auth.supabase.from("applications").select("id, company, role").eq("user_id", auth.userId),
      email.gmail_thread_id ? auth.supabase.from("email_imports").select("application_id").eq("user_id", auth.userId).eq("mailbox_email", email.mailbox_email).eq("gmail_thread_id", email.gmail_thread_id).eq("review_status", "applied") : Promise.resolve({ data: [], error: null }),
    ]);
    if (apps.error || thread.error) throw new Error("Could not match the application. Sync again.");
    const decision = emailDecision(email, apps.data ?? [], (thread.data ?? []).map(row => row.application_id).filter(Boolean));
    let appliedId: string | null = null;
    if (decision?.canApply) {
      const result = await auth.supabase.rpc("apply_email_automatically", { import_id: email.id, company_name: decision.company, role_name: decision.role, new_status: decision.status, target_application_id: decision.target?.id ?? null, task_title: decision.task, automatic: true });
      if (result.error) throw new Error("Could not apply an email update. Your saved imports are safe; sync again.");
      appliedId = result.data;
    }
    if (appliedId) applied++;
    else {
      const { error: saveError } = await auth.supabase.from("email_imports").update({ automation_checked: true, ...(decision ? { reason: decision.canApply ? "This application has a newer manual change. Confirm how to apply this email." : decision.clarification, suggested_company: decision.company, suggested_role: decision.role, suggested_status: decision.status ?? email.suggested_status } : { review_status: "ignored" }) }).eq("id", email.id).eq("user_id", auth.userId).eq("review_status", "pending");
      if (saveError) throw new Error("Could not save clarification progress. Sync again.");
      if (decision) clarifications++;
    }
  }
  return { applied, clarifications, more: (pending?.length ?? 0) > 30 };
}

export async function undoEmail(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticate();
  if (!auth) return { error: "Sign in again." };
  const id = String(form.get("id") ?? "");
  if (!validUuid(id)) return { error: "Invalid update." };
  const { error } = await auth.supabase.rpc("undo_email_update", { import_id: id });
  if (error) return { error: "Cannot undo while newer changes exist. Undo the newer email updates first, or edit the application directly. Completed interview tasks also protect their update." };
  revalidatePath("/"); revalidatePath("/email");
  return { message: "Update undone. Newly created applications remain as Saved.", saved: Date.now() };
}
