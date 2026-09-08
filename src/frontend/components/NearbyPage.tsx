"use client";
import { useEffect, useMemo, useState } from "react";
import type { HazardKind, NewsArticle, SourceResult } from "@/types/intelligence";
import { AppShell } from "./AppShell";
import { LocationSafetyManager, useLocationSafety } from "./LocationSafetyManager";
import { usePreferences } from "./AppPreferences";
import { fetchLive } from "@/frontend/lib/live-data";
import { DataState, NewsCards, SourceStamp } from "./LiveCards";

const filters: Array<{ value: HazardKind | "all"; key: string }> = [{ value: "all", key: "all" }, { value: "flood", key: "flood" }, { value: "landslide", key: "landslide" }, { value: "earthquake", key: "earthquake" }, { value: "cyclone", key: "cyclone" }, { value: "fire", key: "fire" }, { value: "extreme-weather", key: "weatherHazard" }, { value: "other", key: "other" }];
export function NearbyPage() {
  const { t } = usePreferences();
  const { location } = useLocationSafety();
  const [filter, setFilter] = useState<HazardKind | "all">("all");
  const [radius, setRadius] = useState("100");
  const [result, setResult] = useState<SourceResult<NewsArticle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ radius: radius === "state" ? "250" : radius, limit: "30" });
    if (location) { query.set("lat", String(location.latitude)); query.set("lon", String(location.longitude)); if (location.state) query.set("state", location.state); if (location.district && radius !== "state") query.set("district", location.district); }
    setLoading(true); setResult(null);
    fetchLive<SourceResult<NewsArticle[]>>(`/api/disaster-news?${query}`, controller.signal).then((data) => { if (!controller.signal.aborted) setResult(data); }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [location, radius, revision]);
  const articles = useMemo(() => {
    const seen = new Set<string>();
    return (result?.data || []).filter((article) => { if ((filter !== "all" && article.hazardType !== filter) || seen.has(article.clusterKey || article.id)) return false; seen.add(article.clusterKey || article.id); return true; });
  }, [result, filter]);
  return <AppShell title={t("live.news")} description={t("live.newsDescription")}><div className="live-dashboard"><LocationSafetyManager /><section className="content-card live-nearby"><div className="live-news-filters"><div role="group" aria-label={t("live.news")}>{filters.map((item) => <button key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}>{t(`live.${item.key}`)}</button>)}</div><label>{t("live.radius")}<select value={radius} onChange={(event) => setRadius(event.target.value)}>{[25, 50, 100, 250].map((value) => <option key={value} value={value}>{value} km</option>)}<option value="state">{t("live.statewide")}</option></select></label></div><p className="live-caution">{t("live.newsStateScope")}</p>{loading ? <DataState loading /> : !result || result.status === "unavailable" ? <DataState message="live.newsUnavailable" retry={() => setRevision((value) => value + 1)} /> : !articles.length ? <DataState message="live.noNews" /> : <NewsCards articles={articles} />}<SourceStamp source="GDELT" time={result?.fetchedAt} status={result?.status} /></section></div></AppShell>;
}
