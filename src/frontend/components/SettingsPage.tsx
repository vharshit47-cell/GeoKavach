"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "./AppShell";
import { usePreferences } from "./AppPreferences";
import { useLocationSafety } from "./LocationSafetyManager";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "@/shared/types/profile";

export function SettingsPage() {
  const { t, language, setLanguage, theme, setTheme } = usePreferences();
  const { selectLocation } = useLocationSafety();
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [permission, setPermission] = useState("settings.permissionUnknown");
  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem("suraksha-notification-preferences") || "{}"); setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...stored }); } catch { /* Device storage unavailable. */ }
    const abort = new AbortController();
    void fetch("/api/profile", { signal: abort.signal, cache: "no-store" }).then(async r => { if (r.ok) { const data = await r.json(); setSignedIn(true); setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...data.preferences }); } }).catch(() => {});
    return () => abort.abort();
  }, []);
  const update = (key: keyof NotificationPreferences, value: boolean | number) => setPreferences(p => ({ ...p, [key]: value }));
  async function save() {
    setBusy(true); setStatus("");
    try {
      if (signedIn) { const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences }) }); if (!r.ok) throw new Error(); }
      localStorage.setItem("suraksha-notification-preferences", JSON.stringify(preferences));
      window.dispatchEvent(new CustomEvent("suraksha-preferences-changed"));
      setStatus(signedIn ? "settings.saveAccount" : "settings.saveLocal");
    } catch { setStatus("profile.saveFailed"); } finally { setBusy(false); }
  }
  async function notificationPermission() {
    if (!("Notification" in window)) { setStatus("settings.notificationUnsupported"); return; }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") { update("browser_notifications_enabled", true); setStatus("settings.notificationGranted"); }
      else { update("browser_notifications_enabled", false); setStatus("settings.notificationDenied"); }
    } catch { setStatus("settings.notificationUnsupported"); }
  }
  async function checkPermission() {
    try { const result = await navigator.permissions.query({ name: "geolocation" }); setPermission(result.state === "granted" ? "settings.permissionGranted" : result.state === "denied" ? "settings.permissionDenied" : "settings.permissionPrompt"); }
    catch { setPermission("settings.permissionUnknown"); }
  }
  function clearDevice() {
    try { for (const key of ["suraksha-language", "suraksha-theme", "suraksha-notification-preferences", "suraksha-notified-alerts"]) localStorage.removeItem(key); } catch { /* Device storage unavailable. */ }
    window.dispatchEvent(new CustomEvent("suraksha-reset-device"));
    setTheme("system"); setPreferences(DEFAULT_NOTIFICATION_PREFERENCES); selectLocation(null);
    window.dispatchEvent(new CustomEvent("suraksha-preferences-changed")); setStatus("settings.cleared");
  }
  return <AppShell title={t("settings.title")} description={t("settings.description")}>
    {status && <p className="account-notice" role="status">{t(status)}</p>}
    <div className="account-grid"><section className="account-card"><h2>{t("settings.appearance")}</h2><div className="account-form"><label>{t("common.language")}<select value={language} onChange={e => setLanguage(e.target.value === "hi" ? "hi" : "en")}><option value="en">English</option><option value="hi">हिन्दी</option></select></label><label>{t("common.theme")}<select value={theme} onChange={e => setTheme(e.target.value)}>{["light", "dark", "system"].map(value => <option key={value} value={value}>{t(`common.${value}`)}</option>)}</select></label></div>
    <h2>{t("settings.location")}</h2><p>{t("settings.locationNote")}</p><p>{t("settings.locationPermission")}: {t(permission)}</p><button className="secondary-button" onClick={checkPermission}>{t("settings.checkPermission")}</button><div className="account-links"><Link href="/dashboard">{t("settings.openDashboard")}</Link><Link href="/profile">{t("settings.savedLocations")}</Link></div>
    <h2>{t("settings.dataPrivacy")}</h2><p>{t("settings.chatPrivacy")}</p><button className="secondary-button" onClick={clearDevice}>{t("settings.clearLocal")}</button></section>
    <section className="account-card"><h2>{t("settings.notifications")}</h2>{!signedIn && <p>{t("settings.guest")}</p>}<div className="account-form"><label>{t("settings.radius")}<select value={preferences.notification_radius_km} onChange={e => update("notification_radius_km", Number(e.target.value))}>{[10,25,50,100,250].map(r => <option key={r} value={r}>{r} km</option>)}</select></label><fieldset><legend>{t("settings.alertTypes")}</legend>{(["earthquake", "flood", "landslide", "cyclone", "weather", "nearby_news"] as const).map(type => <label className="account-check" key={type}><input type="checkbox" checked={preferences[`${type}_enabled`]} onChange={e => update(`${type}_enabled`, e.target.checked)} />{t(`settings.${type === "nearby_news" ? "news" : type}`)}</label>)}</fieldset><p>{t("settings.notificationConsent")}</p><button className="secondary-button" onClick={notificationPermission}>{t("settings.enableNotifications")}</button><label className="account-check"><input type="checkbox" checked={preferences.browser_notifications_enabled} onChange={e => { if (!e.target.checked) update("browser_notifications_enabled", false); else void notificationPermission(); }} />{t("settings.notificationEnabled")}</label><p>{t("settings.notificationNote")}</p><button className="primary-button" onClick={save} disabled={busy}>{t(busy ? "common.saving" : "common.save")}</button></div></section></div>
  </AppShell>;
}
