"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { usePreferences } from "./AppPreferences";
import { useLocationSafety } from "./LocationSafetyManager";
import { getSupabaseBrowserClient } from "@/frontend/lib/supabase/client";
import { INDIA_REGIONS } from "@/config/india";
import type { Profile, SavedLocation } from "@/shared/types/profile";

export function ProfilePage() {
  const { t, language, setLanguage } = usePreferences();
  const { selectLocation } = useLocationSafety();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/profile", { signal: abort.signal, cache: "no-store" }).then(async r => {
      if (!r.ok) throw new Error();
      const data = await r.json(); setProfile(data.profile); setLocations(data.locations); setEmail(data.email || "");
    }).catch(() => { if (!abort.signal.aborted) setStatus("profile.storageUnavailable"); });
    return () => abort.abort();
  }, [revision]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: form.get("full_name"), state: form.get("state"), district: form.get("district"), preferred_language: language }) });
      setStatus(r.ok ? "common.saved" : "profile.saveFailed");
    } catch { setStatus("profile.saveFailed"); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { const r = await fetch(`/api/saved-locations?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (!r.ok) throw new Error(); setLocations(items => items.filter(item => item.id !== id)); setStatus("profile.locationRemoved"); }
    catch { setStatus("profile.removeFailed"); } finally { setBusy(false); }
  }
  async function signout() {
    setBusy(true);
    const result = await getSupabaseBrowserClient()?.auth.signOut();
    if (result?.error) { setStatus("auth.failed"); setBusy(false); }
    else { selectLocation(null); window.location.assign("/dashboard"); }
  }
  return <AppShell title={t("profile.title")} description={t("profile.description")}>
    {status && <p role="status" className="account-notice">{t(status)}</p>}
    {!profile ? <div className="account-card">{status ? <button className="secondary-button" onClick={() => { setStatus(""); setRevision(r => r + 1); }}>{t("common.retry")}</button> : t("common.loading")}</div> : <div className="account-grid">
      <section className="account-card"><h2>{t("profile.personal")}</h2><form className="account-form" onSubmit={save}>
        <label>{t("auth.fullName")}<input name="full_name" required maxLength={120} defaultValue={profile.full_name} /></label>
        <label>{t("auth.email")}<input type="email" value={email} readOnly /><small>{t("profile.emailNote")}</small></label>
        <label>{t("common.language")}<select value={language} onChange={e => setLanguage(e.target.value === "hi" ? "hi" : "en")}><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
        <label>{t("common.state")}<select name="state" defaultValue={profile.state || ""}><option value="">{t("common.chooseState")}</option>{INDIA_REGIONS.map(r => <option key={r.name} value={r.name}>{language === "hi" ? r.hindi : r.name}</option>)}</select></label>
        <label>{t("common.district")}<input name="district" maxLength={120} defaultValue={profile.district || ""} /></label>
        <button className="primary-button" disabled={busy}>{t(busy ? "common.saving" : "common.save")}</button>
      </form><div className="account-links"><Link href="/forgot-password">{t("profile.password")}</Link><Link href="/settings">{t("settings.notifications")}</Link><button className="secondary-button" onClick={signout} disabled={busy}>{t("auth.signout")}</button></div></section>
      <section className="account-card"><h2>{t("profile.locations")}</h2><p>{t("profile.locationPrivacy")}</p>{locations.length === 0 ? <p>{t("profile.noLocations")}</p> : locations.map(loc => <article className="saved-location" key={loc.id}><strong>{loc.name}</strong><p>{loc.district} {loc.state}</p><small>{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</small><div className="account-links"><button className="secondary-button" onClick={() => { selectLocation({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude, state: loc.state || undefined, district: loc.district || undefined }); router.push("/dashboard"); }}>{t("settings.openDashboard")}</button><button className="secondary-button" onClick={() => remove(loc.id)} disabled={busy}>{t("common.remove")}</button></div></article>)}</section>
    </div>}
  </AppShell>;
}
