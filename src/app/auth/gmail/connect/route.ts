import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { encrypt, gmailConfigured, gmailScope } from "@/lib/gmail";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000"));
  if (!gmailConfigured()) return NextResponse.redirect(new URL("/email?gmail=setup", process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000"));
  const state = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: process.env.GOOGLE_REDIRECT_URI!, response_type: "code", scope: gmailScope, access_type: "offline", prompt: "consent", state }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("gmail_oauth", encrypt(JSON.stringify({ state, userId: data.user.id, expires: Date.now() + 600000 })), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth/gmail", maxAge: 600 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
