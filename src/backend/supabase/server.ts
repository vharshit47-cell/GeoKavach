import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/frontend/lib/supabase/config";

export async function getSupabaseServerClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Rendering cannot set cookies. src/proxy.ts refreshes them before rendering. */ }
      },
    },
  });
}

export async function getVerifiedUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };
  try {
    const { data, error } = await supabase.auth.getUser();
    return { supabase, user: error ? null : data.user };
  } catch { return { supabase, user: null }; }
}
