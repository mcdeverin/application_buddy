import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path=request.nextUrl.pathname;
  const demoPath=path==="/demo"||path.startsWith("/demo/");
  if(process.env.DEMO_ONLY==="true"&&!demoPath) return NextResponse.redirect(new URL("/demo",request.url));
  if(demoPath) {
    const demoResponse=NextResponse.next({request});
    demoResponse.headers.set("Cache-Control","private, no-store");
    demoResponse.headers.set("X-Robots-Tag","noindex, nofollow");
    return demoResponse;
  }
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return request.nextUrl.pathname === "/login" ? response : NextResponse.redirect(new URL("/login", request.url));
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  const publicRoute = request.nextUrl.pathname === "/login" || request.nextUrl.pathname.startsWith("/auth/");
  if (!data?.claims && !publicRoute) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
