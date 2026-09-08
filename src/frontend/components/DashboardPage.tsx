"use client";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, Hospital, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "./AppShell";
import { usePreferences } from "./AppPreferences";
import { LocationSafetyManager, NotificationOptIn, useLocationSafety } from "./LocationSafetyManager";
import { AlertsPanel, EarthquakesPanel, FacilitiesPanel, NewsPanel, RiskIndicators, WeatherPanel } from "./LiveCards";
import { LiveMap } from "./LiveMap";
import { timeLabel } from "@/frontend/lib/live-data";

export function DashboardPage() {
  const { t, language } = usePreferences();
  const { location, data, nationalAlerts, nationalEarthquakes, loading, error, refresh } = useLocationSafety();
  const alerts = location ? data?.alerts || null : nationalAlerts;
  const earthquakes = location ? data?.earthquakes || null : nationalEarthquakes;
  const status = data?.risk.status || "UNKNOWN";
  const statuses: Record<string, string> = { UNKNOWN: "UNKNOWN", WATCH: "WATCH", WARNING: "WARNING", SEVERE_ALERT: "SEVERE", NO_SIGNIFICANT_SIGNAL: "NORMAL" };
  const sources = [alerts, data?.weather, earthquakes, data?.news, data?.facilities, data?.groundwater].filter(Boolean);
  const alertCount = alerts && alerts.status !== "unavailable" ? alerts.data.filter((alert) => alert.active).length : "—";
  return <AppShell title={t("live.title")} description={t("live.subtitle")} actions={<button className="secondary-button" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading ? "spin" : ""} />{t("live.refresh")}</button>}>
    <div className="live-dashboard">
      <LocationSafetyManager />
      <section className={`live-safety-overview status-${status}`} aria-live="polite"><div className="live-safety-icon"><ShieldAlert size={26} /></div><div><span>{t("live.safety")}</span><h2>{loading && location ? t("live.loading") : t(`live.${statuses[status]}`)}</h2><p>{!location ? t("live.selectForSafety") : !alerts || alerts.status === "unavailable" ? t("live.officialUnavailable") : t("live.notGuarantee")}</p></div><div className="live-safety-context"><strong>{location?.district || location?.state || t("live.allStates")}</strong><small>{t("live.updated")}: {timeLabel(data?.updatedAt || alerts?.fetchedAt, language)}</small></div></section>
      {error && <div className="live-caution" role="alert"><AlertTriangle size={16} />{t("live.networkError")}<button className="live-text-button" onClick={refresh}>{t("live.retry")}</button></div>}
      <section className="live-kpi-grid"><div><ShieldAlert size={19} /><span>{t("live.alerts")}</span><strong>{loading ? "…" : alertCount}</strong><small>NDMA SACHET</small></div><div><Activity size={19} /><span>{t("live.earthquakes")}</span><strong>{loading ? "…" : earthquakes && earthquakes.status !== "unavailable" ? earthquakes.data.length : "—"}</strong><small>USGS · {t("live.observed")}</small></div><div><Hospital size={19} /><span>{t("live.facilities")}</span><strong>{loading && location ? "…" : data?.facilities && data.facilities.status !== "unavailable" ? data.facilities.data.length : "—"}</strong><small>{t("live.capacityUnknown")}</small></div><div><AlertTriangle size={19} /><span>{t("live.score")}</span><strong>{data?.risk.score ?? "—"}<em>/100</em></strong><small>{t("live.derived")}</small></div></section>
      <div className="live-primary-grid"><LiveMap /><WeatherPanel result={data?.weather || null} loading={loading} hasLocation={!!location} /></div>
      <div className="live-detail-grid"><AlertsPanel result={alerts} loading={loading} retry={refresh} /><div className="live-panel-stack"><RiskIndicators risk={data?.risk} groundwater={data?.groundwater} loading={loading && !!location} /><EarthquakesPanel result={earthquakes} loading={loading} /></div><FacilitiesPanel result={data?.facilities || null} loading={loading} hasLocation={!!location} /></div>
      <NewsPanel result={data?.news || null} loading={loading} hasLocation={!!location} />
      <NotificationOptIn />
      <section className="content-card live-data-sources"><h2>{t("live.sources")}</h2><div>{sources.map((source) => source && <article key={source.source}><strong>{source.source}</strong><span className={`source-status ${source.status}`}>{t(`live.sourceStatus.${source.status}`)}</span><small>{timeLabel(source.fetchedAt, language)}</small></article>)}</div><p>{t("live.noPopulation")} · {t("live.noHighRiskCount")}</p></section>
      <section className="content-card live-demo-entry"><div><span className="live-evidence demo">{t("live.demo")}</span><h2>{t("live.planning")}</h2><p>{t("live.planningNote")}</p></div><Link className="secondary-button" href="/demo">{t("live.openDemo")}<ArrowUpRight size={14} /></Link></section>
    </div>
  </AppShell>;
}
