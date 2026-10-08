import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../../utils/supabase/server";

export async function POST(request: NextRequest) {
  // Reject cross-origin posts that could sign someone out unexpectedly.
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return new NextResponse("Unable to sign out. Please try again.", { status: 500 });
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
