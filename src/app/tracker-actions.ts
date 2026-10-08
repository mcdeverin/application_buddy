"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../utils/supabase/server";
import { statuses, safeJobUrl, validUuid, parseDate } from "@/lib/tracker";

export type MutationState = { error?: string; message?: string; saved?: number };

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

function field(form: FormData, name: string, max = 500): string {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export async function saveApplication(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticatedClient();
  if (!auth) return { error: "Your session expired. Sign in again." };
  const company = field(form, "company", 200);
  const role = field(form, "role", 250);
  const status = field(form, "status");
  if (!company || !role) return { error: "Enter a company and role." };
  if (!statuses.some(value => value === status)) return { error: "Choose a valid stage." };
  const rawUrl = field(form, "job_url", 2000);
  const jobUrl = safeJobUrl(rawUrl);
  if (rawUrl && !jobUrl) return { error: "Use a full job link beginning with https:// or http://." };
  const rawDate = field(form, "applied_at");
  const appliedAt = parseDate(rawDate);
  if (rawDate && !appliedAt) return { error: "Enter a valid application date." };
  const id = field(form, "id");
  if (id && !validUuid(id)) return { error: "Invalid application." };
  const values = {
    company, role, status, job_url: jobUrl,
    location: field(form, "location", 250) || null,
    salary: field(form, "salary", 200) || null,
    source: field(form, "source", 200) || null,
    applied_at: appliedAt, last_update_at: new Date().toISOString(),
  };
  const result = id
    ? await auth.supabase.from("applications").update(values).eq("id", id).eq("user_id", auth.userId).select("id").maybeSingle()
    : await auth.supabase.from("applications").insert({ ...values, user_id: auth.userId }).select("id").single();
  if (result.error) return { error: "Could not save the application. Please try again." };
  if (!result.data) return { error: "Application was not found in your account." };
  revalidatePath("/");
  return { message: id ? "Application updated." : "Application added.", saved: Date.now() };
}

export async function saveTask(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticatedClient();
  if (!auth) return { error: "Your session expired. Sign in again." };
  const title = field(form, "title", 500);
  if (!title) return { error: "Enter a task title." };
  const applicationId = field(form, "application_id");
  if (applicationId) {
    if (!validUuid(applicationId)) return { error: "Choose a valid application." };
    const { data, error } = await auth.supabase.from("applications").select("id").eq("id", applicationId).eq("user_id", auth.userId).maybeSingle();
    if (error || !data) return { error: "Application was not found in your account." };
  }
  const rawDate = field(form, "due_at");
  const dueAt = parseDate(rawDate);
  if (rawDate && !dueAt) return { error: "Enter a valid due date." };
  const { error } = await auth.supabase.from("actions").insert({
    user_id: auth.userId, title, application_id: applicationId || null,
    due_at: dueAt, action_type: "Follow up", completed: false,
  });
  if (error) return { error: "Could not add the task. Please try again." };
  revalidatePath("/");
  return { message: "Task added.", saved: Date.now() };
}

export async function toggleTask(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticatedClient();
  if (!auth) return { error: "Your session expired. Sign in again." };
  const id = field(form, "id");
  const completed = field(form, "completed");
  if (!validUuid(id) || !["true", "false"].includes(completed)) return { error: "Invalid task." };
  const { data, error } = await auth.supabase.from("actions").update({ completed: completed === "true" }).eq("id", id).eq("user_id", auth.userId).select("id").maybeSingle();
  if (error || !data) return { error: "Could not update the task. Please try again." };
  revalidatePath("/");
  return { message: completed === "true" ? "Task completed." : "Task reopened.", saved: Date.now() };
}

export async function addEvent(_previous: MutationState, form: FormData): Promise<MutationState> {
  const auth = await authenticatedClient();
  if (!auth) return { error: "Your session expired. Sign in again." };
  const applicationId = field(form, "application_id");
  const eventType = field(form, "event_type");
  if (!validUuid(applicationId) || !["Note", "Interview"].includes(eventType)) return { error: "Choose a valid application and event." };
  const { data, error: lookupError } = await auth.supabase.from("applications").select("id").eq("id", applicationId).eq("user_id", auth.userId).maybeSingle();
  if (lookupError || !data) return { error: "Application was not found in your account." };
  const description = field(form, "description", 10000);
  if (!description) return { error: "Add your notes or interview details." };
  const rawDate = field(form, "occurred_at");
  const occurredAt = parseDate(rawDate);
  if ((rawDate && !occurredAt) || (eventType === "Interview" && !occurredAt)) return { error: "Choose a valid interview date and time." };
  const { error } = await auth.supabase.from("application_events").insert({
    user_id: auth.userId, application_id: applicationId, event_type: eventType,
    description, source: "Manual", occurred_at: occurredAt || new Date().toISOString(),
  });
  if (error) return { error: "Could not save this entry. Please try again." };
  revalidatePath("/");
  return { message: eventType === "Interview" ? "Interview added." : "Note added.", saved: Date.now() };
}
