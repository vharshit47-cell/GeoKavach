export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key || key.startsWith("sb_secret_") || /placeholder|your[_-]/i.test(url + key)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
  } catch { return null; }
  return { url, key };
}

export function safeAuthRedirect(value: string | null | undefined) {
  // A fixed set avoids protocol-relative URLs, encoded slashes, and open redirects.
  return ["/dashboard", "/profile", "/settings", "/nearby", "/auth/update-password"].includes(value || "") ? value! : "/profile";
}
