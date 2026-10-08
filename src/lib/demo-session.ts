import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const demoCookie = 'application-buddy-demo';
export const demoSessionSeconds = 8 * 60 * 60;
export function demoConfigured(code: string | undefined) { return !!code && code.length >= 12; }
export function validDemoCode(provided: string, expected: string | undefined) {
  return demoConfigured(expected) && provided.length <= 256 && timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(expected!).digest());
}
export function createDemoSession(code: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ version: 1, expires: now + demoSessionSeconds * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  const signature = createHmac('sha256', `application-buddy-demo:${code}`).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function validDemoSession(value: string | undefined, code: string | undefined, now = Date.now()) {
  if (!value || value.length > 1024 || !demoConfigured(code)) return false;
  try {
    const parts = value.split('.'); if (parts.length !== 2) return false;
    const expected = createHmac('sha256', `application-buddy-demo:${code}`).update(parts[0]).digest();
    const signature = Buffer.from(parts[1], 'base64url');
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return payload.version === 1 && typeof payload.nonce === 'string' && typeof payload.expires === 'number' && payload.expires > now && payload.expires <= now + demoSessionSeconds * 1000;
  } catch { return false; }
}
