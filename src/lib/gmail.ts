import "server-only";
import { readGmail } from "./gmail-request";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";
export function gmailConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && process.env.EMAIL_TOKEN_ENCRYPTION_KEY);
}
function key() {
  const value = Buffer.from(process.env.EMAIL_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (value.length !== 32) throw new Error("Set EMAIL_TOKEN_ENCRYPTION_KEY to a base64-encoded 32-byte key.");
  return value;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString("base64url")).join(".");
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split(".").map(v => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export type GoogleTokens = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
export async function exchangeTokens(values: Record<string, string>): Promise<GoogleTokens> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...values }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Google authorization expired or was rejected. Reconnect Gmail.");
  const result = await response.json();
  if (!result.access_token) throw new Error("Google did not return an access token.");
  return result;
}
export async function gmailGet<T>(path: string, token: string): Promise<T> {
  return readGmail<T>(path, token);
}
