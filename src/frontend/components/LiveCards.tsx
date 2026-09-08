"use client";

import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, CloudRain, ExternalLink, Hospital, ShieldAlert } from "lucide-react";
import type { DisasterAlert, EarthquakeEvent, GroundwaterData, LiveRisk, NearbyFacility, NewsArticle, SourceResult, WeatherData } from "@/types/intelligence";
import { safeSourceUrl, timeLabel } from "@/frontend/lib/live-data";
import { usePreferences } from "./AppPreferences";

export function EvidenceTag({ kind }: { kind: string }) {
  const { t } = usePreferences();
  return <span className={`live-evidence ${kind}`}>{t(`live.${kind === "model-derived" ? "derived" : kind}`)}</span>;
}

export function SourceStamp({ source, time, status, label = "updated" }: { source: string; time?: string | null; status?: string; label?: "updated" | "published" | "firstSeen" }) {
  const { t, language } = usePreferences();
  return <div className="live-source"><span>{t("live.source")}: {source}</span>{time && <span>{t(`live.${label}`)}: {timeLabel(time, language)}</span>}{status === "stale" && <strong>{t("live.stale")}</strong>}</div>;
}

export function SourceLink({ url, children }: { url?: string; children?: React.ReactNode }) {
  const { t } = usePreferences();
  const safe = safeSourceUrl(url);
  return safe ? <a className="live-source-link" href={safe} target="_blank" rel="noopener noreferrer">{children || t("live.viewSource")}<ExternalLink size={12} /></a> : null;
}

export function DataState({ loading, message, retry }: { loading?: boolean; message?: string; retry?: () => void }) {
  const { t } = usePreferences();
  return <div className={`live-data-state ${loading ? "is-loading" : ""}`} role="status">{loading && <div className="live-skeleton" />}<p>{t(loading ? "live.loading" : message || "live.unavailable")}</p>{retry && !loading && <button className="secondary-button" onClick={retry}>{t("live.retry")}</button>}</div>;
}

export function AlertsPanel({ result, loading, retry }: { result: SourceResult<DisasterAlert[]> | null; loading: boolean; retry: () => void }) {
  const { t, language } = usePreferences();
  const alerts = [...(result?.data || [])].filter((alert) => alert.active).sort((a, b) => a.priority.localeCompare(b.priority));
  return <section className="content-card live-panel" id="official-alerts"><div className="live-panel-heading"><div><h2><ShieldAlert size={17} />{t("live.alerts")}</h2><p>{t("live.regionalAlerts")}</p></div><EvidenceTag kind="official" /></div>
    {loading ? <DataState loading /> : !result || result.status === "unavailable" ? <><DataState message="live.officialUnavailable" retry={retry} /><SourceLink url="https://sachet.ndma.gov.in/">{t("live.readOfficial")}</SourceLink></> : !alerts.length ? <DataState message="live.noAlerts" /> : <div className="live-alert-list">{alerts.slice(0, 8).map((alert) => <article className={`live-alert severity-${alert.severity}`} key={alert.id}><div className="live-item-top"><span className="live-priority">{alert.priority} · {t(`live.severity.${alert.severity}`)}</span><time>{timeLabel(alert.publishedAt, language)}</time></div><h3>{alert.title}</h3>{alert.affectedArea && <p><strong>{t("live.area")}:</strong> {alert.affectedArea}</p>}{alert.distanceKm !== undefined && <p>{t("live.distance")}: {alert.distanceKm.toFixed(1)} km</p>}<p>{alert.description}</p>{alert.action && <div className="live-alert-action"><strong>{t("live.action")}</strong><p>{alert.action}</p></div>}{alert.endTime && <small>{t("live.expires")}: {timeLabel(alert.endTime, language)}</small>}<div className="live-item-links">{(alert.latitude !== undefined || !!alert.polygons?.length || !!alert.circles?.length) && <a className="live-source-link" href="#india-map" onClick={() => window.dispatchEvent(new CustomEvent("suraksha-live-map-focus", { detail: alert }))}>{t("live.viewMap")}<ArrowUpRight size={12} /></a>}<SourceLink url={alert.sourceUrl} /></div></article>)}</div>}
    <p className="live-muted">{t("live.alertCoverage")}</p><SourceLink url="https://sachet.ndma.gov.in/">{t("live.readOfficial")}</SourceLink>
    <SourceStamp source={result?.source || "NDMA SACHET"} time={result?.fetchedAt} status={result?.status} />
  </section>;
}

export function WeatherPanel({ result, loading, hasLocation }: { result: SourceResult<WeatherData | null> | null; loading: boolean; hasLocation: boolean }) {
  const { t, language } = usePreferences();
  const weather = result?.data;
  return <section className="content-card live-panel"><div className="live-panel-heading"><h2><CloudRain size={17} />{t("live.weather")}</h2><EvidenceTag kind="model-derived" /></div>
    {!hasLocation ? <DataState message="live.chooseWeather" /> : loading ? <DataState loading /> : !weather ? <DataState message="live.weatherUnavailable" /> : <>
      <div className="live-weather-main"><strong>{weather.temperatureC ?? "—"}<small>°C</small></strong><span>{t("live.temperature")}<br />{timeLabel(weather.time, language)}</span></div>
      <dl className="live-weather-metrics">{[["rainfall", weather.rainMm ?? weather.precipitationMm, "mm"], ["wind", weather.windKph, "km/h"], ["gust", weather.gustKph, "km/h"], ["humidity", weather.humidityPct, "%"]].map(([key, value, unit]) => <div key={String(key)}><dt>{t(`live.${key}`)}</dt><dd>{value ?? "—"} <small>{unit}</small></dd></div>)}</dl>
      {weather.forecast.length > 0 && <div className="live-forecast"><h3>{t("live.forecast")}</h3>{weather.forecast.slice(0, 3).map((day) => <div key={day.date}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric" })}</span><strong>{day.temperatureMinC ?? "—"}–{day.temperatureMaxC ?? "—"}°</strong><span>{day.precipitationMm ?? "—"} mm</span><span aria-label={t("live.precipitation")}>{day.precipitationProbabilityPct ?? "—"}%</span></div>)}</div>}
    </>}
    <SourceStamp source="Open-Meteo" time={result?.fetchedAt} status={result?.status} />
  </section>;
}

export function EarthquakesPanel({ result, loading }: { result: SourceResult<EarthquakeEvent[]> | null; loading: boolean }) {
  const { t, language } = usePreferences();
  return <section className="content-card live-panel"><div className="live-panel-heading"><h2><Activity size={17} />{t("live.earthquakes")}</h2><EvidenceTag kind="observed" /></div>{loading ? <DataState loading /> : !result || result.status === "unavailable" ? <DataState /> : !result.data.length ? <DataState message="live.noEarthquakes" /> : <div className="live-compact-list">{result.data.slice(0, 6).map((quake) => <article key={quake.id} className="live-quake"><span className={`live-magnitude ${quake.magnitude >= 5 ? "strong" : ""}`} aria-label={`${t("live.magnitude")} ${quake.magnitude}`}>M {quake.magnitude.toFixed(1)}</span><div><h3>{quake.place}</h3><p>{timeLabel(quake.time, language)}</p><p>{t("live.depth")}: {quake.depthKm.toFixed(1)} km{quake.distanceKm !== undefined && ` · ${t("live.distance")}: ${quake.distanceKm.toFixed(1)} km`}</p><SourceLink url={quake.sourceUrl} /></div></article>)}</div>}<SourceStamp source="USGS" time={result?.fetchedAt} status={result?.status} /></section>;
}

export function FacilitiesPanel({ result, loading, hasLocation }: { result: SourceResult<NearbyFacility[]> | null; loading: boolean; hasLocation: boolean }) {
  const { t } = usePreferences();
  return <section className="content-card live-panel"><div className="live-panel-heading"><div><h2><Hospital size={17} />{t("live.facilities")}</h2><p>{t("live.facilityRadius")}</p></div><EvidenceTag kind="reported" /></div><p className="live-caution"><AlertTriangle size={14} />{t("live.safetyUnknown")}</p>{!hasLocation ? <DataState message="live.chooseLocation" /> : loading ? <DataState loading /> : !result || result.status === "unavailable" ? <DataState message="live.facilitiesUnavailable" /> : !result.data.length ? <DataState message="live.noFacilities" /> : <div className="live-compact-list">{result.data.slice(0, 8).map((site) => <article key={site.id} className="live-facility"><div><h3>{site.name}</h3><p>{t(`live.facility.${site.type}`)} · {site.distanceKm.toFixed(1)} km</p><small>{t("live.capacityUnknown")}</small></div><SourceLink url={site.sourceUrl} /></article>)}</div>}<SourceStamp source="OpenStreetMap" time={result?.fetchedAt} status={result?.status} /></section>;
}

export function NewsCards({ articles }: { articles: NewsArticle[] }) {
  const { t, language } = usePreferences();
  return <div className="live-news-grid">{articles.map((article) => <article className="live-news-card" key={article.id}><div className="live-item-top"><EvidenceTag kind="reported" /><span>{t(`live.${article.hazardType === "extreme-weather" ? "weatherHazard" : article.hazardType}`)}</span></div><h3>{article.title}</h3><p>{article.locationLabel}</p><small>{t("live.newsNoDistance")}</small><div className="live-news-reliability">{t(article.reliability === "major-news-source" ? "live.majorNews" : "live.otherReport")}</div><SourceStamp source={article.source} time={article.publishedAt} label="firstSeen" /><SourceLink url={article.sourceUrl} /></article>)}</div>;
}

export function NewsPanel({ result, loading, hasLocation }: { result: SourceResult<NewsArticle[]> | null; loading: boolean; hasLocation: boolean }) {
  const { t } = usePreferences();
  return <section className="content-card live-panel live-news-section"><div className="live-panel-heading"><div><h2>{t("live.news")}</h2><p>{t("live.newsDescription")}</p></div><Link className="live-source-link" href="/nearby">{t("live.moreNews")}<ArrowUpRight size={14} /></Link></div>{!hasLocation ? <DataState message="live.chooseLocation" /> : loading ? <DataState loading /> : !result || result.status === "unavailable" ? <DataState message="live.newsUnavailable" /> : !result.data.length ? <DataState message="live.noNews" /> : <NewsCards articles={result.data.slice(0, 4)} />}<SourceStamp source="GDELT" time={result?.fetchedAt} status={result?.status} /></section>;
}

export function RiskIndicators({ risk, groundwater, loading }: { risk?: LiveRisk; groundwater?: SourceResult<GroundwaterData | null>; loading: boolean }) {
  const { t } = usePreferences();
  return <section className="content-card live-panel"><div className="live-panel-heading"><h2>{t("live.risk")}</h2><EvidenceTag kind="model-derived" /></div><p className="live-muted">{t("live.riskNote")}</p>{loading ? <DataState loading /> : !risk || risk.score === null ? <DataState message="live.riskUnavailable" /> : <><div className="live-risk-score"><strong>{risk.score}</strong><span>/ 100<br />{t("live.score")}</span></div><h3>{t("live.riskExplain")}</h3><ul className="live-risk-factors">{risk.factors.map((factor) => <li key={factor.code}><div><strong>{t(`live.factor.${factor.code}`) === `live.factor.${factor.code}` ? factor.label : t(`live.factor.${factor.code}`)}</strong><small>{factor.source} · <EvidenceTag kind={factor.kind} /></small><details><summary>{t("live.details")}</summary><p>{factor.detail}</p></details></div><b>+{factor.points}</b></li>)}</ul></>}
    <details className="live-groundwater"><summary>{t("live.historical")} · {t("live.layerGroundwater")}</summary><p>{t("live.groundwaterNote")}</p>{groundwater?.data && <p>{groundwater.data.stations.length} {t("live.groundwaterStations")} · {groundwater.data.earliestDate || "—"} — {groundwater.data.latestDate || "—"}</p>}</details>
  </section>;
}

