const safeReasons = new Set(['authError', 'invalidArgument', 'badRequest', 'notFound', 'insufficientPermissions', 'forbidden', 'accessNotConfigured', 'domainPolicy', 'dailyLimitExceeded', 'userRateLimitExceeded', 'rateLimitExceeded', 'backendError', 'failedPrecondition']);
export class GmailError extends Error {
  constructor(public status: number, public reason: string, operation: string) {
    const code = `HTTP ${status}${reason ? `: ${reason}` : ''}`;
    const advice = status === 401 ? 'Reconnect Gmail to renew read access.' : status === 403 && !/LimitExceeded/.test(reason) ? 'Check Gmail read permission and Google API setup.' : status === 429 || /LimitExceeded/.test(reason) ? 'Google is limiting requests. Your progress is saved; try again shortly.' : status >= 500 ? 'Gmail is temporarily unavailable. Your progress is saved; try again shortly.' : 'Your saved applications are safe.';
    super(`Gmail could not ${operation} (${code}). ${advice}`);
    this.name = 'GmailError';
  }
}
export async function readGmail<T>(path: string, token: string, fetcher: typeof fetch = fetch, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  const operation = path.startsWith('messages?') ? 'list emails' : path.startsWith('threads/') ? 'read a conversation' : path.startsWith('messages/') ? 'read an email' : 'read the account';
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetcher(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    } catch {
      if (attempt < 2) { await wait(1000 * 2 ** attempt); continue; }
      throw new Error(`Gmail could not ${operation} because the connection timed out or failed. Your progress is saved; try syncing again.`);
    }
    if (response.ok) return response.json();
    const body = await response.json().catch(() => null);
    const rawReason = body?.error?.errors?.[0]?.reason;
    const reason = safeReasons.has(rawReason) ? rawReason : '';
    const retryable = response.status === 429 || response.status >= 500 || (response.status === 403 && ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason));
    const retryAfter = response.headers.get('retry-after');
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const delay = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()) : 1000 * 2 ** attempt;
    if (retryable && attempt < 2 && Number.isFinite(delay) && delay >= 0 && delay <= 10000) { await wait(delay); continue; }
    throw new GmailError(response.status, reason, operation);
  }
  throw new Error('Gmail sync failed.');
}
export async function readGmailPage<T>(params: URLSearchParams, request: (path: string) => Promise<T>, resetCursor: () => Promise<void>): Promise<T> {
  try { return await request(`messages?${params}`); }
  catch (error) {
    // Only retry a rejected saved cursor. A bad query or permissions failure must remain visible.
    if (!(error instanceof GmailError) || error.status !== 400 || !params.has('pageToken')) throw error;
    params.delete('pageToken');
    await resetCursor();
    return request(`messages?${params}`);
  }
}
export async function readOptionalGmail<T>(request: () => Promise<T>): Promise<T | null> {
  try { return await request(); } catch (error) {
    // Messages can disappear between listing and reading (e.g. deleted in Gmail).
    if (error instanceof GmailError && error.status === 404) return null;
    throw error;
  }
}
export async function readWithRefresh<T>(request: () => Promise<T>, refresh: () => Promise<void>): Promise<T> {
  try { return await request(); } catch (error) {
    if (!(error instanceof GmailError) || error.status !== 401) throw error;
    await refresh();
    return request();
  }
}
