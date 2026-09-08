"use client";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, LoaderCircle, MapPin, RefreshCw, X } from "lucide-react";
import type { LocationPoint } from "@/types/intelligence";
import { reservedStatuses, type CaseRecord, type SiteRecord } from "@/shared/workflow/model";
import { alertAnchor, alertMatches, inViewport, type MapHazard, type MapLayers, type MapMode, type Selection, type Viewport } from "@/frontend/lib/map/presentation";
import { timeLabel } from "@/frontend/lib/live-data";
import { AppShell } from "../AppShell";
import { LocationSafetyManager, useLocationSafety } from "../LocationSafetyManager";
import { GoogleLocationMap } from "../GoogleLocationMap";
import { MapControls } from "./MapControls";
import { MapLegend } from "./MapLegend";
import { RiskSummaryPanel } from "./RiskSummaryPanel";
import { RiskInsightsPanel } from "./RiskInsightsPanel";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { useMapBoundary, useMapWorkflow } from "./useMapData";
import "@/frontend/styles/risk-map.css";

const Canvas = dynamic(() => import("./RiskMapCanvas"), { ssr: false, loading: () => <div className="atlas-map-loading"><LoaderCircle size={22} className="spin" /><span>Preparing the intelligence map…</span></div> });
const EMPTY_CASES: CaseRecord[] = [];
const EMPTY_SITES: SiteRecord[] = [];

export function RiskMapWorkspace() {
  const { location, data, nationalAlerts, nationalEarthquakes, loading, error, selectLocation, selectMapLocation, locateOnce, locating, refresh } = useLocationSafety();
  const workflow = useMapWorkflow();
  const [mode, setMode] = useState<MapMode>("hazard");
  const [hazard, setHazard] = useState<MapHazard>("all");
  const [selection, setSelection] = useState<Selection>(null);
  const [view, setView] = useState<Viewport | null>(null);
  const [opacity, setOpacity] = useState(.35);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [drawer, setDrawer] = useState<"summary" | "insights" | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [layers, setLayers] = useState<MapLayers>({ habitations: true, sites: true, redZones: true, alerts: true, earthquakes: true, facilities: true, weather: false, states: true, districts: true });
  const states = useMapBoundary("ADM1", layers.states);
  const districts = useMapBoundary("ADM2", layers.districts && !!location?.state && (view?.zoom ?? 4) >= 6, location?.state);
  const allCases = workflow.snapshot?.cases ?? EMPTY_CASES;
  const allSites = workflow.snapshot?.sites ?? EMPTY_SITES;
  const casesInView = useMemo(() => allCases.filter(record => inViewport(record, view)), [allCases, view]);
  const alertsSource = location ? data?.alerts : nationalAlerts;
  const earthquakesSource = location ? data?.earthquakes : nationalEarthquakes;
  const alerts = useMemo(() => (alertsSource?.data ?? []).filter(alert => alert.active && alertMatches(alert, hazard)), [alertsSource, hazard]);
  const earthquakes = useMemo(() => earthquakesSource?.data ?? [], [earthquakesSource]);
  const focus = useMemo(() => {
    if (selection?.kind === "habitation") return allCases.find(record => record.id === selection.id) ?? null;
    if (selection?.kind === "site") return allSites.find(record => record.id === selection.id) ?? null;
    if (selection?.kind === "alert") { const point = alertAnchor(selection.record); return point ? { ...point, zoom: 9 } : null; }
    if (selection?.kind === "earthquake" || selection?.kind === "facility") return { latitude: selection.record.latitude, longitude: selection.record.longitude, zoom: selection.kind === "facility" ? 13 : 9 };
    return null;
  }, [selection, allCases, allSites]);
  const select = useCallback((next: Selection) => { setSelection(next); setInsightsOpen(true); setDrawer("insights"); }, []);
  const chooseLocation = useCallback((point: LocationPoint) => { setSelection(null); setInsightsOpen(true); setDrawer(null); if (point.state || point.name) selectLocation(point); else selectMapLocation(point); }, [selectLocation, selectMapLocation]);
  const setActiveHazard = useCallback((value: MapHazard) => { setHazard(value); setSelection(null); }, []);
  const connection = useMemo(() => {
    const plan = workflow.snapshot?.plans.find(record => reservedStatuses.includes(record.status) && (selection?.kind === "habitation" && record.caseId === selection.id || selection?.kind === "site" && record.siteId === selection.id));
    const origin = plan && allCases.find(record => record.id === plan.caseId);
    const destination = plan && allSites.find(record => record.id === plan.siteId);
    return origin && destination ? { origin, destination } : null;
  }, [workflow.snapshot, selection, allCases, allSites]);
  const region = location?.district || location?.state || location?.name || (location ? "Selected map location" : "India · all regions");
  const unavailable = [layers.alerts && alertsSource?.status === "unavailable" && "Official warnings", layers.earthquakes && earthquakesSource?.status === "unavailable" && "Earthquakes", states.error && layers.states && "State boundaries", districts.error && layers.districts && "District boundaries"].filter(Boolean);
  const noGeometry = alerts.filter(alert => alert.latitude === undefined && !alert.polygons?.length && !alert.circles?.length).length;
  const refreshAll = () => { refresh(); workflow.refresh(); if (states.error) states.retry(); if (districts.error) districts.retry(); };
  return <AppShell title="Hazard Intelligence" description="Explore hazards, assess exposure and connect evidence to relocation decisions." actions={<button className="atlas-page-refresh" onClick={refreshAll} disabled={loading || workflow.loading}><RefreshCw size={13} />Refresh evidence</button>}>
    <section className={`risk-atlas ${drawer ? `atlas-drawer-${drawer}` : ""}`} aria-label="SurakshaSetu hazard intelligence map">
      <div className="atlas-canvas"><MapErrorBoundary><Canvas location={location} focus={focus} resetKey={resetKey} onLocation={chooseLocation} cases={allCases} sites={allSites} data={data} alerts={alerts} earthquakes={earthquakes} states={states.result} districts={districts.result} layers={layers} hazard={hazard} mode={mode} opacity={opacity} selection={selection} onSelect={select} onViewport={setView} connection={connection} /></MapErrorBoundary></div>
      <MapControls mode={mode} setMode={value => { setMode(value); setLayers(previous => ({ ...previous, alerts: value !== "exposure", earthquakes: value === "hazard", sites: true, habitations: true, facilities: value === "exposure" })); }} hazard={hazard} setHazard={setActiveHazard} layers={layers} setLayers={setLayers} opacity={opacity} setOpacity={setOpacity} cases={allCases} sites={allSites} onSelect={select} onLocation={chooseLocation} onReset={() => { selectLocation(null); setSelection(null); setResetKey(value => value + 1); setDrawer(null); }} onLocate={() => { setSelection(null); locateOnce(); }} locating={locating} onRegion={() => setRegionOpen(true)} region={region} />
      {summaryOpen && <RiskSummaryPanel cases={casesInView} snapshot={workflow.snapshot} hazard={hazard} alerts={alerts} earthquakes={hazard === "all" || hazard === "multi" || hazard === "earthquake" ? earthquakes : []} available={!!alertsSource && alertsSource.status !== "unavailable"} liveLoading={loading} loading={workflow.loading} error={workflow.error} onRetry={workflow.refresh} onSelect={select} onHazard={setActiveHazard} onCollapse={() => { setSummaryOpen(false); setDrawer(null); }} />}
      {!summaryOpen && <button className="atlas-restore-summary atlas-glass" onClick={() => setSummaryOpen(true)}><ChevronRight size={15} />Summary</button>}
      {insightsOpen && <RiskInsightsPanel selection={selection} snapshot={workflow.snapshot} cases={casesInView} hazard={hazard} data={data} alerts={alerts} earthquakes={hazard === "all" || hazard === "multi" || hazard === "earthquake" ? earthquakes : []} available={!!alertsSource && alertsSource.status !== "unavailable"} onSelect={select} region={region} loading={loading} onClose={() => setSelection(null)} onCollapse={() => { setInsightsOpen(false); setDrawer(null); }} />}
      {!insightsOpen && <button className="atlas-restore-insights atlas-glass" onClick={() => setInsightsOpen(true)}>Insights<ChevronLeft size={15} /></button>}
      <MapLegend hazard={hazard} mode={mode} />
      <div className="atlas-status atlas-glass" role="status"><span className={loading ? "atlas-status-dot is-loading" : "atlas-status-dot"} />{loading ? "Updating current evidence…" : unavailable.length ? `${unavailable.join(", ")} temporarily unavailable` : error ? "Some live sources could not be reached" : `${alertsSource?.status === "stale" ? "Stale" : "Latest"} provider evidence · ${timeLabel(alertsSource?.fetchedAt || earthquakesSource?.fetchedAt, "en")}`}{!loading && (error || unavailable.length > 0) && <button onClick={refreshAll}>Retry</button>}</div>
      <div className="atlas-mobile-tabs atlas-glass"><button aria-pressed={drawer === "summary"} onClick={() => { setSummaryOpen(true); setDrawer(drawer === "summary" ? null : "summary"); }}><BarChart3 size={15} />Summary</button><button aria-pressed={drawer === "insights"} onClick={() => { setInsightsOpen(true); setDrawer(drawer === "insights" ? null : "insights"); }}><MapPin size={15} />Insights</button>{drawer && <button aria-label="Close map panel" onClick={() => setDrawer(null)}><X size={16} /></button>}</div>
      {regionOpen && <div className="atlas-region-dialog atlas-glass" role="dialog" aria-modal="false" aria-label="Select map region"><button className="atlas-dialog-close" aria-label="Close region controls" onClick={() => setRegionOpen(false)} autoFocus><X size={18} /></button><LocationSafetyManager /><button className="atlas-cta" onClick={() => { setRegionOpen(false); setSelection(null); }}>Explore selected region <ChevronRight size={15} /></button></div>}
    </section>
    <div className="atlas-data-footer"><span>NDMA SACHET · USGS · Open-Meteo · OpenStreetMap</span><span>{noGeometry > 0 ? `${noGeometry} warnings have no geographic extent. ` : ""}Warning polygons are not declared red zones. Boundaries: {states.result?.data?.license || "reference GIS"}.</span><details><summary>Location tools & source notes</summary><p>Saved field records retain the existing risk and capacity rules. Historical hazard layers and declared red-zone polygons are not connected. No disaster observations or assessments are generated for display.</p><GoogleLocationMap location={location} /></details></div>
  </AppShell>;
}
