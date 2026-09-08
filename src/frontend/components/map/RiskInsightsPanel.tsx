import Link from "next/link";
import { ArrowUpRight, ChevronRight, MapPin, ShieldCheck, X } from "lucide-react";
import { HAZARDS, candidates, capacity, risk, type CaseRecord, type Snapshot } from "@/shared/workflow/model";
import type { DisasterAlert, EarthquakeEvent, LocationIntelligence } from "@/types/intelligence";
import { CurrentEvidence } from "./CurrentEvidence";
import { safeSourceUrl, timeLabel } from "@/frontend/lib/live-data";
import { caseValue, hazardLabel, numberLabel, relocationLink, riskStyle, RISK_SCALE, type MapHazard, type Selection } from "@/frontend/lib/map/presentation";

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="atlas-detail-row"><span>{label}</span><strong>{value}</strong></div>; }
function Source({ url }: { url?: string }) { const safe = safeSourceUrl(url); return safe ? <a className="atlas-text-link" href={safe} target="_blank" rel="noopener noreferrer">View source <ArrowUpRight size={13} /></a> : null; }

export function RiskInsightsPanel({ selection, snapshot, cases, hazard, data, alerts, earthquakes, available, onSelect, region, loading, onClose, onCollapse }: {
  selection: Selection; snapshot: Snapshot | null; cases: CaseRecord[]; hazard: MapHazard; data: LocationIntelligence | null;
  alerts: DisasterAlert[]; region: string; loading: boolean; onClose: () => void; onCollapse: () => void;
  earthquakes: EarthquakeEvent[]; available: boolean; onSelect: (selection: Selection) => void;
}) {
  const home = selection?.kind === "habitation" ? snapshot?.cases.find(record => record.id === selection.id) : undefined;
  const site = selection?.kind === "site" ? snapshot?.sites.find(record => record.id === selection.id) : undefined;
  const scope = home ? [home] : cases;
  const scores = scope.map(record => caseValue(record, hazard)).filter((value): value is number => value !== null);
  const isOverall = hazard === "all" || hazard === "multi";
  const score = scores.length ? Math.max(...scores) : !selection && isOverall ? data?.risk.score ?? null : null;
  const style = riskStyle(score);
  const matches = home && snapshot ? candidates(home, snapshot.sites, snapshot.plans) : [];
  const distribution = RISK_SCALE.map(band => ({ ...band, count: scores.filter(value => riskStyle(value).label === band.label).length }));
  const selectedEvent = selection && "record" in selection ? selection.record : null;
  const name = home?.name || site?.name || (selectedEvent && ("title" in selectedEvent ? selectedEvent.title : "place" in selectedEvent ? selectedEvent.place : selectedEvent.name)) || region;
  const sitePlans = site && snapshot ? snapshot.plans.filter(plan => plan.siteId === site.id) : [];
  const planOrigin = sitePlans.length ? snapshot?.cases.find(record => record.id === sitePlans[0].caseId) : undefined;
  // Reuse the workflow's reservation and eligibility calculation, including occupancy.
  const siteMatch = site && snapshot?.cases[0] ? candidates(snapshot.cases[0], [site], snapshot.plans)[0] : null;
  return <aside className="atlas-insights atlas-panel atlas-glass" aria-label="Risk Insights">
    <div className="atlas-panel-heading"><div><span className="atlas-eyebrow">DECISION SUPPORT</span><h2>Risk Insights</h2></div><button aria-label={selection ? "Clear selection" : "Collapse insights"} onClick={selection ? onClose : onCollapse}>{selection ? <X size={17} /> : <ChevronRight size={17} />}</button></div>
    <div className="atlas-panel-body">
      <div className="atlas-insight-location"><MapPin size={14} /><span>{name}</span></div>
      {!selection && !scope.length && <CurrentEvidence alerts={alerts} earthquakes={earthquakes} available={available} loading={loading} onSelect={onSelect} chart />}
      {site ? <>
        <div className="atlas-site-status"><ShieldCheck size={21} /><div><strong>{site.verified ? "Field-verified site" : "Verification required"}</strong><span>Assessed {site.assessedAt}</span></div></div>
        <section><Metric label="Carrying capacity" value={numberLabel(capacity(site))} /><Metric label="Current occupancy" value={numberLabel(site.occupied)} /><Metric label="Reserved places" value={numberLabel(siteMatch?.reserved)} /><Metric label="Available capacity" value={numberLabel(siteMatch?.available)} /><Metric label="Residual hazard intensity" value={`${site.hazard} / 5`} /><Metric label="Road access" value={site.verified ? "Included in field verification" : "Unverified"} /></section>
        <section><h3>Capacity constraints</h3>{(["land", "water", "sanitation", "shelter"] as const).map(key => <Metric key={key} label={key} value={numberLabel(site[key])} />)}<p className="atlas-muted">{site.evidence}</p></section>
        <Link className="atlas-cta" href={relocationLink(planOrigin, site)}>View Relocation Plan <ArrowUpRight size={15} /></Link>
      </> : selection?.kind === "alert" ? <>
        <span className="atlas-badge">OFFICIAL · NDMA SACHET</span><section><Metric label="Severity" value={selection.record.severity} /><Metric label="Hazard" value={selection.record.hazardType} /><Metric label="Affected area" value={selection.record.affectedArea || "See official bulletin"} /><Metric label="Published" value={timeLabel(selection.record.publishedAt, "en")} /><p className="atlas-muted">{selection.record.description}</p>{selection.record.action && <p>{selection.record.action}</p>}<Source url={selection.record.sourceUrl} /></section><p className="atlas-footnote">Official warning extent. This is not a declared relocation red zone; population exposure has not been assessed by this feed.</p>
      </> : selection?.kind === "earthquake" ? <><span className="atlas-badge">OBSERVED · USGS</span><div className="atlas-score">M {selection.record.magnitude.toFixed(1)}</div><Metric label="Depth" value={`${selection.record.depthKm} km`} /><Metric label="Observed" value={timeLabel(selection.record.time, "en")} /><Source url={selection.record.sourceUrl} /><p className="atlas-muted">Magnitude is an observation, not a local impact or vulnerability score.</p></> : selection?.kind === "facility" ? <><span className="atlas-badge">REPORTED · OPENSTREETMAP</span><section><Metric label="Facility type" value={selection.record.type} /><Metric label="Distance from selected region point" value={`${selection.record.distanceKm.toFixed(1)} km`} /><Metric label="Relocation capacity" value="Unknown" /><Metric label="Safety assessment" value="Unassessed" /><p className="atlas-muted">{selection.record.reason}</p><Source url={selection.record.sourceUrl} /></section></> : <>
        <section><div className="atlas-label-row"><span>{scores.length ? home ? "Selected assessment" : "Highest assessment in view" : "Selected point screening"}</span><span className="atlas-badge" style={{ color: style.color }}>{style.label}</span></div><div className="atlas-score" style={{ color: style.color }}>{numberLabel(score === null ? null : isOverall ? score : score / 20)}<small> / {isOverall ? "100" : "5"}</small></div>
          <p className="atlas-muted">{home ? `Workflow priority: ${risk(home).category} · ${risk(home).confidence}` : score === null ? loading ? "Loading current intelligence…" : "No risk data available for this region." : scores.length ? "Highest recorded value in the current view. This is not an India-wide risk estimate." : data?.risk.explanation}</p>
        </section>
        <section><h3>Hazard breakdown <span>INTENSITY /5</span></h3>{HAZARDS.map(key => { const value = scope.length ? Math.max(...scope.map(record => record.hazards[key])) : null; return <div className="atlas-bar-row" key={key}><span>{hazardLabel(key)}</span><div><i style={{ width: `${(value ?? 0) * 20}%`, background: riskStyle(value === null ? null : value * 20).color }} /></div><strong>{value ?? "—"}</strong></div>; })}<p className="atlas-footnote">Field-assessed intensities. Earthquake and cyclone scores are not part of the existing assessment model.</p></section>
        <section><Metric label={home ? "Population" : "Assessed population in view"} value={scope.length ? numberLabel(scope.reduce((sum, record) => sum + record.population, 0)) : "—"} /><Metric label="Vulnerable people" value={scope.length ? numberLabel(scope.reduce((sum, record) => sum + record.vulnerable, 0)) : "—"} /><Metric label="Red-zone review candidates" value={scope.length ? scope.filter(record => risk(record).redZone).length : "—"} />{home && <><Metric label="Relocation status" value={snapshot?.plans.find(plan => plan.caseId === home.id)?.status || "Needs assessment review"} /><Metric label="Eligible safe sites" value={matches.filter(match => match.eligible).length} /></>}</section>
        {home ? <><section><h3>Recommended safe sites</h3>{matches.filter(match => match.eligible).slice(0, 3).map(match => <Link className="atlas-recommendation" href={relocationLink(home, match.site)} key={match.site.id}><ShieldCheck size={16} /><span>{match.site.name}<small>{numberLabel(match.available)} places · {match.distance.toFixed(1)} km straight-line</small></span><ArrowUpRight size={14} /></Link>)}{!matches.some(match => match.eligible) && <p className="atlas-muted">No site meets the existing capacity and evidence checks.</p>}</section><Link className="atlas-cta" href={relocationLink(home)}>Analyse Relocation <ArrowUpRight size={15} /></Link></> : <section><h3>Risk distribution <span>{scores.length} ASSESSED</span></h3><div className="atlas-distribution" role="img" aria-label={distribution.map(item => `${item.label}: ${item.count}`).join(", ")}>{distribution.map(item => item.count > 0 && <span key={item.label} style={{ flex: item.count, background: item.color }} />)}</div>{distribution.map(item => <div className="atlas-distribution-row" key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{scores.length ? `${Math.round(item.count / scores.length * 100)}%` : "—"}</strong><small>{item.count}</small></div>)}</section>}
        {!home && <p className="atlas-footnote">{alerts.length} matching current official warnings in the provider feed. No warning does not establish safety.</p>}
      </>}
    </div>
  </aside>;
}
