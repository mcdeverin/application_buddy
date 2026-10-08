import { EMAIL_QUERY_REVISION } from "./email-filter";
export type SyncWindow = { from: string; next: string | null };
export function readSyncWindow(value: string | null, connectedAt: string): SyncWindow {
  if (value?.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.version === 1 && typeof parsed.from === 'string' && Number.isFinite(new Date(parsed.from).getTime()) && (parsed.next === null || typeof parsed.next === 'string')) return { from: parsed.from, next: parsed.queryRevision === EMAIL_QUERY_REVISION ? parsed.next : null };
    } catch { /* Fall back to the original connection window. */ }
    return { from: connectedAt, next: null };
  }
  return { from: connectedAt, next: null };
}
export function writeSyncWindow(window: SyncWindow): string {
  return JSON.stringify({ version: 1, queryRevision: EMAIL_QUERY_REVISION, ...window });
}
export function resolveSyncWindow(stored: SyncWindow, requested: string | undefined, now = Date.now()): SyncWindow {
  if (!requested) return stored;
  const date = new Date(requested);
  if (!Number.isFinite(date.getTime()) || date.getTime() > now) throw new Error('Choose a valid start date that is not in the future.');
  const from = date.toISOString();
  return { from, next: new Date(stored.from).getTime() === date.getTime() ? stored.next : null };
}
