import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/backend/supabase/server";
import { safeAuthRedirect } from "@/frontend/lib/supabase/config";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeAuthRedirect(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return NextResponse.redirect(new URL(next, url.origin));
      } else if (tokenHash && type && ["signup", "recovery", "email"].includes(type)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/auth/update-password" : next, url.origin));
      }
    }
  } catch { /* Do not expose authentication codes or provider errors. */ }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
