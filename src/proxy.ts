import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/frontend/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  const protectedPath = request.nextUrl.pathname === "/profile" || request.nextUrl.pathname.startsWith("/profile/") || request.nextUrl.pathname === "/auth/update-password";
  const redirectToLogin = () => {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = ""; url.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  };
  if (!config) return protectedPath ? redirectToLogin() : response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // Refresh only. Sensitive routes separately verify identity and use database RLS.
  try { const { data, error } = await supabase.auth.getClaims(); if (protectedPath && (error || !data?.claims)) return redirectToLogin(); }
  catch { if (protectedPath) return redirectToLogin(); }
  return response;
}

export const config = {
  matcher: ["/profile/:path*", "/settings/:path*", "/login", "/signup", "/auth/:path*", "/api/profile", "/api/saved-locations"],
};
