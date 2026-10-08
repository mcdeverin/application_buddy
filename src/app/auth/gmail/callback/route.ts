import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { decrypt, encrypt, exchangeTokens, gmailGet, gmailScope } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const finish = (status: string) => {
    const response = NextResponse.redirect(new URL(`/email?gmail=${status}`, process.env.GOOGLE_REDIRECT_URI ?? request.url));
    response.cookies.set("gmail_oauth", "", { httpOnly: true, sameSite: "lax", path: "/auth/gmail", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const cookie = request.cookies.get("gmail_oauth")?.value;
    if (!data.user || !cookie) return finish("failed");
    const state = JSON.parse(decrypt(cookie));
    if (state.userId !== data.user.id || state.state !== request.nextUrl.searchParams.get("state") || state.expires < Date.now()) return finish("failed");
    const code = request.nextUrl.searchParams.get("code");
    if (!code || request.nextUrl.searchParams.has("error")) return finish("cancelled");
    const tokens = await exchangeTokens({ code, grant_type: "authorization_code", redirect_uri: process.env.GOOGLE_REDIRECT_URI! });
    if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(gmailScope)) return finish("failed");
    const profile = await gmailGet<{ emailAddress: string }>("profile", tokens.access_token);
    const { error } = await supabase.from("email_connections").upsert({
      user_id: data.user.id, email: profile.emailAddress,
      access_token_encrypted: encrypt(tokens.access_token), refresh_token_encrypted: encrypt(tokens.refresh_token),
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(), page_token: null, last_synced_at: null,
    }, { onConflict: "user_id" });
    return finish(error ? "failed" : "connected");
  } catch { return finish("failed"); }
}
