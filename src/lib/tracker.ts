export const statuses = ["Saved", "Applied", "Screening", "Interview", "Final", "Offer", "Rejected", "Withdrawn"] as const;
export type Application = {
  id: string; company: string; role: string; status: string;
  location: string | null; salary: string | null; job_url: string | null;
  source: string | null; applied_at: string | null; last_update_at: string | null;
};
export type Task = {
  id: string; application_id: string | null; title: string;
  action_type: string | null; due_at: string | null; completed: boolean | null;
};
export type ApplicationEvent = {
  id: string; application_id: string; event_type: string;
  description: string | null; source: string | null; occurred_at: string | null;
};

export function safeJobUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
