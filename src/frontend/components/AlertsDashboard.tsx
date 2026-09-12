"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Clock3, CloudLightning, Database, MapPin, Mountain, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Waves } from "lucide-react";
import { AppShell } from "./AppShell";
import { LocationSafetyManager, useLocationSafety } from "./LocationSafetyManager";
import { SourceLink } from "./LiveCards";
import { fetchLive } from "@/frontend/lib/live-data";
import { alertAnchor } from "@/frontend/lib/map/presentation";
import type { DisasterAlert, DisasterOccurrence, DisasterOccurrenceFeed, HazardKind, Severity } from "@/types/intelligence";

const Map = dynamic(() => import("./AlertsMap"), { ssr: false, loading: () => <div className="alerts-empty">Preparing disaster map…</div> });
const priority: Record<Severity, number> = { extreme: 0, severe: 1, high: 2, moderate: 3, low: 4, unknown: 5 };
const coreHazards: HazardKind[] = ["flood", "earthquake", "landslide", "cloudburst"];

type EvidenceFilter = "all" | "warning" | "incident" | "reference";
type DateFilter = "all" | "30" | "365" | "1095";
type DisplayRecord = {
  id: string; recordType: "warning" | "incident"; hazardType: HazardKind; title: string; description: string;
  place: string; date: string; source: string; sourceUrl?: string; severity: Severity; status: string;
  action?: string; mapped: boolean; locationPrecision?: DisasterOccurrence["locationPrecision"];
};

function hazardLabel(hazard: HazardKind) { return hazard.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function severityTone(severity: Severity) { return ["extreme", "severe"].includes(severity) ? "danger" : ["high", "moderate"].includes(severity) ? "amber" : severity === "low" ? "watch" : "unknown"; }
function dateLabel(value: string) { return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST"; }
function withinRange(value: string, range: DateFilter) { return range === "all" || Date.now() - Date.parse(value) <= Number(range) * 24 * 60 * 60_000; }
function HazardIcon({ hazard, size = 18 }: { hazard: HazardKind; size?: number }) {
  if (hazard === "flood") return <Waves size={size} />;
  if (hazard === "earthquake") return <Activity size={size} />;
  if (hazard === "landslide") return <Mountain size={size} />;
  if (hazard === "cloudburst") return <CloudLightning size={size} />;
  return <ShieldAlert size={size} />;
}

export function AlertsDashboard() {
  const { location, data, nationalAlerts, loading: alertLoading, refresh } = useLocationSafety();
  const [occurrenceFeed, setOccurrenceFeed] = useState<DisasterOccurrenceFeed | null>(null);
  const [occurrenceLoading, setOccurrenceLoading] = useState(true);
  const [occurrenceError, setOccurrenceError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [hazard, setHazard] = useState<HazardKind | "all">("all");
  const [evidence, setEvidence] = useState<EvidenceFilter>("all");
  const [dateRange, setDateRange] = useState<DateFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showLocation, setShowLocation] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setOccurrenceLoading(true); setOccurrenceError(false);
    fetchLive<DisasterOccurrenceFeed>("/api/disaster-events", AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]))
      .then(result => { if (!controller.signal.aborted) setOccurrenceFeed(result); })
      .catch(() => { if (!controller.signal.aborted) setOccurrenceError(true); })
      .finally(() => { if (!controller.signal.aborted) setOccurrenceLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const alertResult = location ? data?.alerts : nationalAlerts;
  const alerts = useMemo(() => (alertResult?.data ?? []).filter(item => item.active).sort((a, b) => priority[a.severity] - priority[b.severity] || Date.parse(b.publishedAt) - Date.parse(a.publishedAt)), [alertResult]);
  const occurrences = useMemo(() => occurrenceFeed?.data ?? [], [occurrenceFeed]);
  const search = query.trim().toLowerCase();
  const matches = (itemHazard: HazardKind, date: string, text: string, recordEvidence: EvidenceFilter) =>
    (hazard === "all" || itemHazard === hazard) && withinRange(date, dateRange) && (evidence === "all" || evidence === recordEvidence) && (!search || text.toLowerCase().includes(search));

  const visibleAlerts = useMemo(() => alerts.filter(item => matches(item.hazardType, item.publishedAt, `${item.title} ${item.affectedArea ?? ""} ${item.district ?? ""} ${item.state ?? ""}`, "warning")), [alerts, hazard, dateRange, evidence, search]);
  const visibleOccurrences = useMemo(() => occurrences.filter(item => matches(item.hazardType, item.occurredAt, `${item.title} ${item.place} ${item.description}`, item.kind === "historical" ? "reference" : "incident")), [occurrences, hazard, dateRange, evidence, search]);

  const displayRecords = useMemo<DisplayRecord[]>(() => [
    ...visibleAlerts.map(item => ({ id: item.id, recordType: "warning" as const, hazardType: item.hazardType, title: item.title, description: item.description, place: item.affectedArea || item.district || item.state || "Area not specified", date: item.publishedAt, source: "NDMA SACHET", sourceUrl: item.sourceUrl, severity: item.severity, status: "Active official warning", action: item.action, mapped: !!alertAnchor(item) })),
    ...visibleOccurrences.map(item => ({ id: item.id, recordType: "incident" as const, hazardType: item.hazardType, title: item.title, description: item.description, place: item.place, date: item.occurredAt, source: item.source, sourceUrl: item.sourceUrl, severity: item.severity, status: item.status === "reference" ? "Verified historical incident" : item.status === "ongoing" ? "Ongoing observed event" : item.status === "recent" ? "Recent observed event" : "Recorded event", mapped: true, locationPrecision: item.locationPrecision })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [visibleAlerts, visibleOccurrences]);

  const chosen = displayRecords.find(item => item.id === selected) ?? null;
  const noGeometry = visibleAlerts.filter(item => !alertAnchor(item)).length;
  const region = location?.name || location?.district || location?.state || (location ? "Selected location" : "India + surrounding region");
  const totalByHazard = (kind: HazardKind) => alerts.filter(item => item.hazardType === kind).length + occurrences.filter(item => item.hazardType === kind).length;
  const refreshAll = () => { refresh(); setRevision(value => value + 1); };
  const busy = alertLoading || occurrenceLoading;
  const resetFilters = () => { setHazard("all"); setEvidence("all"); setDateRange("all"); setQuery(""); };

  return <AppShell title="Disaster Occurrence Monitor" description="Observed incidents, official warnings and historical evidence—not a rain-only weather screen." actions={<><button className="secondary-button" onClick={refreshAll} disabled={busy}><RefreshCw size={15} />Refresh sources</button><button className="safety-sos" onClick={() => window.dispatchEvent(new Event("suraksha-open-emergency"))}><ShieldAlert size={16} />Request help</button></>}>
    <div className="alerts-dashboard disaster-monitor">
      <div className="alerts-context"><span><i className="alerts-live-dot" />MULTI-HAZARD EVIDENCE NETWORK · {busy ? "UPDATING" : "READY"}</span><button onClick={() => setShowLocation(!showLocation)} aria-expanded={showLocation}><MapPin size={14} />{region} · Change location</button></div>
      {showLocation && <LocationSafetyManager />}

      <section className="disaster-source-ribbon" aria-label="Data sources">
        <div><Database size={17} /><span><strong>NDMA SACHET</strong><small>Official active warnings · {alertResult?.status ?? "loading"}</small></span></div>
        {(occurrenceFeed?.sources ?? [
          { name: "USGS", status: occurrenceLoading ? "loading" : "unavailable", note: "30-day earthquakes" },
          { name: "NASA EONET / GDACS", status: occurrenceLoading ? "loading" : "unavailable", note: "Floods and landslides" },
          { name: "Government of India / PIB", status: "historical", note: "Verified incident archive" },
        ]).map(source => <div key={source.name}><Database size={17} /><span><strong>{source.name}</strong><small>{source.note} · {source.status}</small></span></div>)}
      </section>

      <section className="disaster-kpis" aria-label="Disaster counts">
        {coreHazards.map(kind => <button key={kind} className={`disaster-kpi hazard-${kind} ${hazard === kind ? "active" : ""}`} onClick={() => setHazard(hazard === kind ? "all" : kind)} aria-pressed={hazard === kind}><span><HazardIcon hazard={kind} size={20} /></span><div><small>{hazardLabel(kind)}</small><strong>{totalByHazard(kind)}</strong><em>mapped records</em></div></button>)}
        <div className="disaster-kpi official"><span><Bell size={20} /></span><div><small>Active warnings</small><strong>{alerts.length}</strong><em>NDMA SACHET</em></div></div>
      </section>

      <section className="alerts-overview"><div className="alerts-section-heading"><h2><MapPin size={18} />Where disasters occurred</h2><span>{displayRecords.length} records in the current view</span></div>
        <div className="alerts-overview-grid"><div className="alerts-map-wrap"><Map location={location} alerts={visibleAlerts} occurrences={visibleOccurrences} selected={chosen?.id ?? null} onSelect={setSelected} /><div className="disaster-map-legend"><span><i className="hazard-flood" />FL Flood</span><span><i className="hazard-earthquake" />EQ Earthquake</span><span><i className="hazard-landslide" />LS Landslide</span><span><i className="hazard-cloudburst" />CB Cloudburst</span><span><i className="warning" />! Active warning</span></div><div className="alerts-map-caption">Incident pins show reported event locations; outlined pins are official active warnings. Area-centroid markers are approximate, not impact boundaries.{noGeometry > 0 && ` ${noGeometry} warning${noGeometry === 1 ? " has" : "s have"} no usable map geometry.`}</div></div>
          <aside className="alerts-quick-info">
            <div className="alerts-info-box disaster-snapshot"><h3>Evidence snapshot</h3><dl><div><dt>Map focus</dt><dd>{region}</dd></div><div><dt>Occurred incidents</dt><dd>{visibleOccurrences.length}</dd></div><div><dt>Active warnings</dt><dd className="text-danger">{visibleAlerts.length}</dd></div><div><dt>Mapped records</dt><dd>{visibleOccurrences.length + visibleAlerts.length - noGeometry}</dd></div></dl></div>
            <div className="alerts-info-box evidence-key"><h3>Read the evidence correctly</h3><p><strong>Warning</strong> means an active authority bulletin. <strong>Observed</strong> means a source recorded an event. <strong>Historical</strong> is a verified reference incident. None of these markers predicts the next disaster.</p></div>
            {chosen && <div className={`alerts-selected ${severityTone(chosen.severity)} hazard-${chosen.hazardType}`} role="status"><span className="record-status">{chosen.status}</span><strong>{chosen.title}</strong><p className="selected-place"><MapPin size={13} />{chosen.place}</p><p>{chosen.action || chosen.description}</p><small>{chosen.source} · {dateLabel(chosen.date)}{chosen.locationPrecision === "area-centroid" ? " · approximate area marker" : ""}</small><SourceLink url={chosen.sourceUrl} /><button className="alerts-text-button" onClick={() => setSelected(null)}>Clear selection</button></div>}
          </aside></div>
      </section>

      <section className="alerts-list-section"><div className="alerts-section-heading"><h2>Disaster evidence log</h2><span>{displayRecords.length} visible · {alerts.length + occurrences.length} total records</span></div>
        <div className="alerts-filters"><span><SlidersHorizontal size={15} />Filters</span><label><span className="sr-only">Disaster type</span><select value={hazard} onChange={event => setHazard(event.target.value as HazardKind | "all")}><option value="all">All disaster types</option>{["flood", "earthquake", "landslide", "cloudburst", "cyclone", "extreme-weather", "fire", "other"].map(item => <option key={item} value={item}>{hazardLabel(item as HazardKind)}</option>)}</select></label><label><span className="sr-only">Evidence type</span><select value={evidence} onChange={event => setEvidence(event.target.value as EvidenceFilter)}><option value="all">Warnings + occurred incidents</option><option value="warning">Active official warnings</option><option value="incident">Observed incidents</option><option value="reference">Historical reference incidents</option></select></label><label><span className="sr-only">Date range</span><select value={dateRange} onChange={event => setDateRange(event.target.value as DateFilter)}><option value="all">All available dates</option><option value="30">Last 30 days</option><option value="365">Last 12 months</option><option value="1095">Last 3 years</option></select></label><label className="alerts-search"><Search size={15} /><input aria-label="Search disaster records" placeholder="Search place or incident…" value={query} onChange={event => setQuery(event.target.value)} /></label>{(hazard !== "all" || evidence !== "all" || dateRange !== "all" || query) && <button className="alerts-text-button" onClick={resetFilters}>Reset</button>}</div>
        {busy && !displayRecords.length ? <div className="alerts-empty" role="status">Loading disaster sources…</div> : !displayRecords.length ? <div className="alerts-empty"><ShieldAlert size={26} /><h3>No records match these filters</h3><p>Reset the date or disaster-type filter. A missing record does not establish that an area is safe.</p><button className="alerts-text-button" onClick={resetFilters}>Show all available records</button></div> : <div className="disaster-record-grid">{displayRecords.map(record => <article key={record.id} className={`disaster-record-card hazard-${record.hazardType} ${record.recordType}`}><div className="disaster-record-symbol"><HazardIcon hazard={record.hazardType} size={19} /></div><div className="disaster-record-content"><div className="disaster-record-meta"><strong>{hazardLabel(record.hazardType)}</strong><span className={`record-kind ${record.recordType}`}>{record.status}</span><span><Clock3 size={12} />{dateLabel(record.date)}</span></div><h3>{record.title}</h3><p className="official-alert-area"><MapPin size={13} />{record.place}{record.locationPrecision === "area-centroid" && <small>Approximate area marker</small>}</p><p>{record.description}</p>{record.action && <p className="record-action"><strong>Authority guidance:</strong> {record.action}</p>}<div className="official-alert-footer"><span>{record.source}</span><div><SourceLink url={record.sourceUrl} />{record.mapped && <button onClick={() => { setSelected(record.id); document.querySelector(".alerts-overview")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Locate on map ↗</button>}</div></div></div></article>)}</div>}
        {(occurrenceError || alertResult?.status === "unavailable") && <p className="disaster-partial-note" role="status">One live source is temporarily unavailable. Records from the remaining sources and the verified reference archive are still shown.</p>}
      </section>
      <p className="alerts-source-note">Coverage is intentionally multi-source and not exhaustive. NDMA SACHET provides warnings; USGS provides observed earthquakes; NASA EONET curates natural-event metadata and links to sources such as GDACS; PIB reference records document selected past incidents. This is disaster situational awareness, not a weather forecast or an evacuation order. <Link href="/nearby">Explore nearby help →</Link></p>
    </div>
  </AppShell>;
}
