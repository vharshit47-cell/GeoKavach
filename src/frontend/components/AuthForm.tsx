"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { usePreferences } from "./AppPreferences";
import { AppShell } from "./AppShell";
import { getSupabaseBrowserClient } from "@/frontend/lib/supabase/client";
import { safeAuthRedirect, supabaseConfig } from "@/frontend/lib/supabase/config";
import { INDIA_REGIONS } from "@/config/india";

export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" | "update" }) {
  const { t, language, setLanguage } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (new URLSearchParams(window.location.search).has("error")) setMessage("auth.failed"); }, []);
  const configured = Boolean(supabaseConfig());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    if (mode === "signup" || mode === "update") {
      if (password.length < 8) { setMessage("auth.weakPassword"); return; }
      if (password !== fields.get("confirm")) { setMessage("auth.mismatch"); return; }
    }
    const client = getSupabaseBrowserClient();
    if (!client) { setMessage("auth.notConfigured"); return; }
    setBusy(true);
    try {
      const redirectBase = window.location.origin;
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) setMessage("auth.invalidLogin");
        else window.location.assign(safeAuthRedirect(new URLSearchParams(window.location.search).get("next")));
      } else if (mode === "signup") {
        const { error, data } = await client.auth.signUp({ email, password, options: {
          emailRedirectTo: `${redirectBase}/auth/callback?next=/profile`,
          data: { full_name: String(fields.get("full_name") || "").trim(), preferred_language: language, state: String(fields.get("state") || ""), district: String(fields.get("district") || "").trim() },
        } });
        if (error) setMessage("auth.failed");
        else if (data.session) window.location.assign("/profile");
        else setMessage("auth.confirmEmail");
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${redirectBase}/auth/callback?next=/auth/update-password` });
        setMessage(error ? "auth.failed" : "auth.resetSent");
      } else {
        const { error } = await client.auth.updateUser({ password });
        setMessage(error ? "auth.failed" : "auth.passwordUpdated");
      }
    } catch { setMessage("auth.connectionError"); }
    finally { setBusy(false); }
  }
  return <AppShell title={t(`auth.${mode}Title`)} description={t(`auth.${mode}Description`)}>
    <section className="account-card auth-card"><ShieldCheck size={32} aria-hidden="true" />
      {!configured && <p className="account-notice" role="status">{t("auth.notConfigured")}</p>}
      <form onSubmit={submit} className="account-form">
        {mode === "signup" && <label>{t("auth.fullName")}<input name="full_name" required maxLength={120} autoComplete="name" /></label>}
        {mode !== "update" && <label>{t("auth.email")}<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>}
        {mode !== "forgot" && <label>{t("auth.password")}<input name="password" type="password" required minLength={mode === "login" ? 1 : 8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} /><small>{t("auth.passwordHint")}</small></label>}
        {(mode === "signup" || mode === "update") && <label>{t("auth.confirmPassword")}<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>}
        {mode === "signup" && <><label>{t("common.language")}<select value={language} onChange={e => setLanguage(e.target.value === "hi" ? "hi" : "en")}><option value="en">English</option><option value="hi">हिन्दी</option></select></label><label>{t("common.state")}<select name="state"><option value="">{t("common.chooseState")}</option>{INDIA_REGIONS.map(r => <option key={r.name} value={r.name}>{language === "hi" ? r.hindi : r.name}</option>)}</select></label><label>{t("common.district")} · {t("common.optional")}<input name="district" maxLength={120} autoComplete="address-level2" /></label><p>{t("auth.privacy")}</p></>}
        {message && <p role="status" className="account-notice">{t(message)}</p>}
        <button className="primary-button" type="submit" disabled={busy || !configured}>{busy ? t("auth.working") : t(mode === "forgot" ? "auth.reset" : `auth.${mode}`)}</button>
      </form>
      <div className="account-links">{mode === "login" ? <><Link href="/signup">{t("auth.signup")}</Link><Link href="/forgot-password">{t("auth.forgot")}</Link></> : <Link href="/login">{t("auth.backLogin")}</Link>}<Link href="/dashboard">{t("auth.guest")}</Link></div>
    </section>
  </AppShell>;
}
