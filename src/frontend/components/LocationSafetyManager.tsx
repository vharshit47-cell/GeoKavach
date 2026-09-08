"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell, LocateFixed, MapPin, Search, X } from "lucide-react";
import type { BoundaryData, DisasterAlert, EarthquakeEvent, LocationIntelligence, LocationPoint, SourceResult } from "@/types/intelligence";
import { INDIA_REGIONS } from "@/config/india";
import { fetchLive } from "@/frontend/lib/live-data";
import { usePreferences } from "./AppPreferences";

type NotificationSettings = { earthquake_enabled: boolean; flood_enabled: boolean; landslide_enabled: boolean; cyclone_enabled: boolean; weather_enabled: boolean; nearby_news_enabled: boolean; notification_radius_km: number; browser_notifications_enabled: boolean };
const notificationDefaults: NotificationSettings = { earthquake_enabled: true, flood_enabled: true, landslide_enabled: true, cyclone_enabled: true, weather_enabled: true, nearby_news_enabled: false, notification_radius_km: 50, browser_notifications_enabled: false };
type SafetyContextValue = {
  location: LocationPoint | null; selectLocation: (point: LocationPoint | null) => void;
  selectMapLocation: (point: LocationPoint) => void;
  data: LocationIntelligence | null; loading: boolean; error: boolean; refresh: () => void;
  nationalAlerts: SourceResult<DisasterAlert[]> | null; nationalEarthquakes: SourceResult<EarthquakeEvent[]> | null;
  locateOnce: () => void; locating: boolean; locationMessage: string;
  notifications: boolean; enableNotifications: () => Promise<void>; notificationMessage: string;
};
const SafetyContext = createContext<SafetyContextValue | null>(null);

export function LocationSafetyProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [data, setData] = useState<LocationIntelligence | null>(null);
  const [nationalAlerts, setNationalAlerts] = useState<SourceResult<DisasterAlert[]> | null>(null);
  const [nationalEarthquakes, setNationalEarthquakes] = useState<SourceResult<EarthquakeEvent[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationSettings, setNotificationSettings] = useState(notificationDefaults);
  const notified = useRef(new Set<string>());
  const locationRequest = useRef(0);
  const selectLocation = useCallback((point: LocationPoint | null) => {
    locationRequest.current += 1;
    setLocating(false);
    setLocation(point);
    setData(null);
    setLocationMessage("");
  }, []);

  useEffect(() => {
    const read = () => {
      try { setNotificationSettings({ ...notificationDefaults, ...JSON.parse(localStorage.getItem("suraksha-notification-preferences") || "{}") }); } catch { /* preferences storage may be blocked */ }
    };
    try { const ids = JSON.parse(localStorage.getItem("suraksha-notified-alerts") || "[]"); if (Array.isArray(ids)) notified.current = new Set(ids.filter((id): id is string => typeof id === "string").slice(-200)); } catch { /* Optional local deduplication. */ }
    read();
    window.addEventListener("suraksha-preferences-changed", read);
    return () => window.removeEventListener("suraksha-preferences-changed", read);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const timeout = window.setTimeout(() => { controller.abort(); setLoading(false); setError(true); }, 60000);
    if (location) {
      const query = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), radius: String(notificationSettings.notification_radius_km) });
      if (location.state) query.set("state", location.state);
      if (location.district) query.set("district", location.district);
      fetchLive<LocationIntelligence>(`/api/location-risk?${query}`, controller.signal)
        .then((result) => { if (!controller.signal.aborted) setData(result); })
        .catch(() => { if (!controller.signal.aborted) { setError(true); setData(null); } })
        .finally(() => { window.clearTimeout(timeout); if (!controller.signal.aborted) setLoading(false); });
    } else {
      Promise.allSettled([
        fetchLive<SourceResult<DisasterAlert[]>>("/api/alerts", controller.signal),
        fetchLive<SourceResult<EarthquakeEvent[]>>("/api/earthquakes", controller.signal),
      ]).then(([alerts, quakes]) => {
        window.clearTimeout(timeout);
        if (controller.signal.aborted) return;
        setNationalAlerts(alerts.status === "fulfilled" ? alerts.value : null);
        setNationalEarthquakes(quakes.status === "fulfilled" ? quakes.value : null);
        setError(alerts.status === "rejected" || quakes.status === "rejected");
        setLoading(false);
      });
    }
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [location, revision, notificationSettings.notification_radius_km]);

  useEffect(() => {
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") setRevision((n) => n + 1); }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data || !location || !notificationSettings.browser_notifications_enabled || !("Notification" in window) || Notification.permission !== "granted" || !["live", "cached"].includes(data.alerts.status)) return;
    const important = data.alerts.data.filter((alert) => {
      const preferenceKey = alert.hazardType === "extreme-weather" ? "weather_enabled" : `${alert.hazardType}_enabled`;
      const hazardEnabled = preferenceKey in notificationSettings ? notificationSettings[preferenceKey as keyof NotificationSettings] === true : notificationSettings.weather_enabled;
      return hazardEnabled && alert.isOfficial && alert.active && !!alert.endTime && Date.parse(alert.endTime) > Date.now() && ["severe", "extreme"].includes(alert.severity) && ["polygon", "district", "nearby"].includes(alert.locationMatch) && (alert.distanceKm === undefined || alert.distanceKm <= notificationSettings.notification_radius_km) && !notified.current.has(alert.id);
    });
    // One notification per refresh; group other relevant alerts to avoid bursts.
    if (important.length) {
      important.forEach((alert) => notified.current.add(alert.id));
      notified.current = new Set([...notified.current].slice(-200));
      try { localStorage.setItem("suraksha-notified-alerts", JSON.stringify([...notified.current])); } catch { /* No coordinates or message content stored. */ }
      try { new Notification(`${t("live.official")} · NDMA SACHET`, { body: important[0].title.slice(0, 200), tag: important[0].id }); } catch { /* Some mobile browsers require a service worker. */ }
    }
  }, [data, location, notificationSettings, t]);

  const locateOnce = () => {
    if (!navigator.geolocation) { setLocationMessage("live.locationError"); return; }
    const requestId = ++locationRequest.current;
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const point: LocationPoint = { latitude: coords.latitude, longitude: coords.longitude };
      if (point.latitude < 6 || point.latitude > 38 || point.longitude < 68 || point.longitude > 98) {
        if (locationRequest.current === requestId) { setLocating(false); setLocationMessage("live.locationError"); }
        return;
      }
      try {
        const result = await fetchLive<SourceResult<LocationPoint[]>>(`/api/geocode?lat=${point.latitude}&lon=${point.longitude}`);
        if (locationRequest.current === requestId) setLocation({ ...result.data[0], ...point });
      } catch { if (locationRequest.current === requestId) setLocation(point); }
      finally { if (locationRequest.current === requestId) { setLocating(false); setData(null); } }
    }, (failure) => {
      if (locationRequest.current !== requestId) return;
      setLocating(false);
      setLocationMessage(failure.code === 1 ? "live.locationDenied" : "live.locationError");
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  };

  const selectMapLocation = async (point: LocationPoint) => {
    const requestId = ++locationRequest.current;
    setLocating(true); setLocationMessage("");
    try {
      const result = await fetchLive<SourceResult<LocationPoint[]>>(`/api/geocode?lat=${point.latitude}&lon=${point.longitude}`);
      if (locationRequest.current === requestId) { setLocation({ ...result.data[0], ...point }); setData(null); }
    } catch { if (locationRequest.current === requestId) { setLocation(point); setData(null); } }
    finally { if (locationRequest.current === requestId) setLocating(false); }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) { setNotificationMessage("live.notifyUnsupported"); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotificationMessage("live.notifyBlocked"); return; }
      const next = { ...notificationSettings, browser_notifications_enabled: true };
      setNotificationSettings(next);
      try { localStorage.setItem("suraksha-notification-preferences", JSON.stringify(next)); } catch { /* Session preference still works. */ }
      window.dispatchEvent(new Event("suraksha-preferences-changed"));
      setNotificationMessage("live.notifyEnabled");
    } catch { setNotificationMessage("live.notifyUnsupported"); }
  };

  return <SafetyContext.Provider value={{ location, selectLocation, selectMapLocation, data, loading, error, refresh: () => setRevision((n) => n + 1), nationalAlerts, nationalEarthquakes, locateOnce, locating, locationMessage, notifications: notificationSettings.browser_notifications_enabled, enableNotifications, notificationMessage }}>{children}</SafetyContext.Provider>;
}

export function useLocationSafety() {
  const context = useContext(SafetyContext);
  if (!context) throw new Error("LocationSafetyProvider is required");
  return context;
}

export function LocationSafetyManager() {
  const { t, language } = usePreferences();
  const { location, selectLocation, locateOnce, locating, locationMessage } = useLocationSafety();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [state, setState] = useState("");
  const [districts, setDistricts] = useState<BoundaryData["names"]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [districtError, setDistrictError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSaveMessage(""); if (location?.state) setState(location.state); if (!location) setState(""); }, [location]);
  useEffect(() => {
    if (!state) { setDistricts([]); return; }
    const controller = new AbortController();
    const region = INDIA_REGIONS.find((entry) => entry.name === state);
    if (!region) return;
    setDistrictLoading(true); setDistrictError(false); setDistricts([]);
    fetchLive<SourceResult<BoundaryData>>(`/api/boundaries?level=ADM2&state=${encodeURIComponent(state)}&lat=${region.latitude}&lon=${region.longitude}`, controller.signal)
      .then((response) => { if (!controller.signal.aborted) { setDistricts(response.data?.names ?? []); setDistrictError(response.status === "unavailable"); } })
      .catch(() => { if (!controller.signal.aborted) setDistrictError(true); })
      .finally(() => { if (!controller.signal.aborted) setDistrictLoading(false); });
    return () => controller.abort();
  }, [state]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2 || searching) return;
    setSearching(true); setMessage(""); setResults([]);
    try {
      const result = await fetchLive<SourceResult<LocationPoint[]>>(`/api/geocode?q=${encodeURIComponent(query.trim())}&language=${language}`);
      setResults(result.data);
      if (!result.data.length) setMessage(result.status === "unavailable" ? "live.searchError" : "live.searchEmpty");
    } catch { setMessage("live.searchError"); } finally { setSearching(false); }
  };

  const saveLocation = async () => {
    if (!location || saving) return;
    setSaving(true); setSaveMessage("");
    try {
      const response = await fetch("/api/saved-locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...location, name: location.name || location.district || location.state || t("live.selectedPoint"), consent: true }) });
      setSaveMessage(response.ok ? "live.saved" : response.status === 401 ? "live.saveLogin" : "live.saveError");
    } catch { setSaveMessage("live.saveError"); } finally { setSaving(false); }
  };

  return <section className="live-location content-card" id="location" aria-label={t("live.location")}>
    <div className="live-location-intro"><MapPin size={21} /><div><h2>{location?.name || location?.district || location?.state || t("live.chooseLocation")}</h2><p>{location ? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)} · ${t("live.locationOnce")}` : t("live.privacy")}</p></div><button className="secondary-button" onClick={locateOnce} disabled={locating}><LocateFixed size={15} />{t(locating ? "live.finding" : "live.gps")}</button></div>
    <div className="live-location-controls">
      <label>{t("live.state")}<select value={state} onChange={(event) => { setState(event.target.value); const region = INDIA_REGIONS.find((entry) => entry.name === event.target.value); selectLocation(region ? { name: region.name, state: region.name, latitude: region.latitude, longitude: region.longitude } : null); }}><option value="">{t("live.allStates")}</option>{INDIA_REGIONS.map((region) => <option key={region.name} value={region.name}>{language === "hi" ? region.hindi : region.name}</option>)}</select></label>
      <label>{t("live.district")}<select value={location?.district || ""} disabled={!state || districtLoading || !districts.length} onChange={(event) => { const district = districts.find((entry) => entry.name === event.target.value); if (district) selectLocation({ name: district.name, district: district.name, state, latitude: district.latitude, longitude: district.longitude }); }}><option value="">{t(districtLoading ? "live.loading" : "live.chooseDistrict")}</option>{districts.map((district) => <option key={district.id} value={district.name}>{district.name}</option>)}</select></label>
      <form onSubmit={search} className="live-search"><label htmlFor="location-search">{t("live.search")}</label><div><input id="location-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} minLength={2} placeholder="Lucknow, Guwahati, Kochi…" /><button className="primary-button" type="submit" disabled={searching || query.trim().length < 2}><Search size={15} />{t(searching ? "live.loading" : "live.searchButton")}</button></div></form>
    </div>
    {districtError && <p className="live-muted">{t("live.districtUnavailable")}</p>}
    {results.length > 0 && <ul className="live-search-results">{results.map((point, index) => <li key={`${point.latitude}-${index}`}><button onClick={() => { selectLocation(point); setResults([]); setMessage(""); }}><MapPin size={14} /><span>{[point.name, point.district, point.state].filter(Boolean).join(" · ")}</span></button></li>)}</ul>}
    {(message || locationMessage) && <p className="live-inline-status" role="status">{t(message || locationMessage)}</p>}
    {location && <div className="live-location-footer"><button className="live-text-button" onClick={saveLocation} disabled={saving}>{t("live.save")}</button><button className="live-text-button" onClick={() => selectLocation(null)}><X size={13} />{t("live.noShare")}</button>{saveMessage && <span role="status">{t(saveMessage)}{saveMessage === "live.saveLogin" && <> <Link href="/login">{t("live.saveLogin")}</Link></>}</span>}</div>}
  </section>;
}

export function NotificationOptIn() {
  const { t } = usePreferences();
  const { enableNotifications, notifications, notificationMessage } = useLocationSafety();
  return <div className="live-notification"><Bell size={17} /><div><p>{t("live.notifyExplanation")}</p><button className="live-text-button" onClick={enableNotifications} disabled={notifications}>{t(notifications ? "live.notifyEnabled" : "live.notify")}</button> · <Link href="/settings">{t("live.settings")}</Link>{notificationMessage && <p role="status">{t(notificationMessage)}</p>}</div></div>;
}
