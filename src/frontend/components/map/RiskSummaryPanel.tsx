import Link from "next/link";
import { Activity, ArrowUpRight, ChevronLeft, CloudRain, Home, Mountain, ShieldCheck, Users, Waves, Wind } from "lucide-react";
import { HAZARDS, risk, type CaseRecord, type Snapshot } from "@/shared/workflow/model";
import type { DisasterAlert, EarthquakeEvent } from "@/types/intelligence";
import { CurrentEvidence } from "./CurrentEvidence";
import { alertMatches, caseValue, hazardLabel, numberLabel, riskStyle, type MapHazard, type Selection } from "@/frontend/lib/map/presentation";

export function RiskSummaryPanel({ cases, snapshot, hazard, alerts, earthquakes, available, liveLoading, loading, error, onRetry, onSelect, onHazard, onCollapse }: {
  cases: CaseRecord[]; snapshot: Snapshot | null; hazard: MapHazard; alerts: DisasterAlert[];
  earthquakes: EarthquakeEvent[]; available: boolean; liveLoading: boolean;
  loading: boolean; error: boolean; onRetry: () => void; onSelect: (selection: Selection) => void; onHazard: (hazard: MapHazard) => void; onCollapse: () => void;
}) {
  const ranked = [...cases].sort((a, b) => (caseValue(b, hazard) ?? -1) - (caseValue(a, hazard) ?? -1));
  const scored = cases.map(record => caseValue(record, hazard)).filter((score): score is number => score !== null);
  const peak = scored.length ? Math.max(...scored) : null;
  const style = riskStyle(peak);
  const critical = cases.filter(record => risk(record).redZone).length;
  return <aside className="atlas-summary atlas-panel atlas-glass" aria-label="Risk Rating Summary">
    <div className="atlas-panel-heading"><div><span className="atlas-eyebrow">REGIONAL INTELLIGENCE</span><h2>Risk Rating Summary</h2></div><button aria-label="Collapse summary" onClick={onCollapse}><ChevronLeft size={17} /></button></div>
    <div className="atlas-panel-body">
      {!cases.length && <CurrentEvidence alerts={alerts} earthquakes={earthquakes} available={available} loading={liveLoading} onSelect={onSelect} />}
      {cases.length > 0 && <section><div className="atlas-label-row"><span>Highest assessed {hazard === "all" || hazard === "multi" ? "risk" : "intensity"}</span><span className="atlas-badge" style={{ color: style.color }}>{style.label}</span></div>
        <div className="atlas-score" style={{ color: style.color }}>{numberLabel(peak === null ? null : hazard === "all" || hazard === "multi" ? peak : peak / 20)}<small> / {hazard === "all" || hazard === "multi" ? "100" : "5"}</small></div>
        <p className="atlas-muted">{loading ? "Loading saved field assessments…" : cases.length ? `${cases.length} assessed habitations in the map view. ${hazardLabel(hazard)} selected.` : "No risk data available for this region."}</p>
        <div className="atlas-metrics"><div><Home size={14} /><strong>{loading ? "—" : cases.length}</strong><span>Habitations</span></div><div><Activity size={14} /><strong>{loading ? "—" : critical}</strong><span>Review candidates</span></div><div><Users size={14} /><strong>{cases.length ? numberLabel(cases.reduce((sum, record) => sum + record.population, 0)) : "—"}</strong><span>Assessed people</span></div><div><ShieldCheck size={14} /><strong>{snapshot ? snapshot.sites.filter(site => site.verified).length : "—"}</strong><span>Verified sites¹</span></div></div>
        <p className="atlas-footnote">¹ Across your workspace. Counts describe recorded assessments, not total regional exposure.</p>
      </section>}
      <section><h3>Top hazard ratings <span>FIELD /5</span></h3><div className="atlas-hazard-grid">{([
        ["flood", Waves], ["landslide", Mountain], ["earthquake", Activity], ["cyclone", Wind], ["coastalErosion", Waves], ["cloudburst", CloudRain],
      ] as const).map(([key, Icon]) => {
        const field = HAZARDS.includes(key as typeof HAZARDS[number]) && cases.length ? Math.max(...cases.map(record => record.hazards[key as typeof HAZARDS[number]])) : null;
        const count = alerts.filter(alert => alertMatches(alert, key)).length;
        return <button key={key} className={hazard === key ? "is-active" : ""} aria-pressed={hazard === key} onClick={() => onHazard(key)}><Icon size={18} /><span>{hazardLabel(key)}</span><strong>{field ?? "—"}<small>{field === null ? count ? `${count} alerts` : "Unassessed" : " / 5"}</small></strong></button>;
      })}</div></section>
      <section><h3>Top habitations at risk <span>{ranked.length}</span></h3>{ranked.length ? <table className="atlas-risk-table"><thead><tr><th>Habitation</th><th>Value</th><th>People</th></tr></thead><tbody>{ranked.slice(0, 6).map(record => { const value = caseValue(record, hazard); return <tr key={record.id}><td><button onClick={() => onSelect({ kind: "habitation", id: record.id })}>{record.name}<ArrowUpRight size={12} /></button></td><td style={{ color: riskStyle(value).color }}>{value === null ? "—" : hazard === "all" || hazard === "multi" ? value : `${value / 20}/5`}</td><td>{numberLabel(record.population)}</td></tr>; })}</tbody></table> : <div className="atlas-empty"><Home size={23} /><strong>{error ? "Assessments temporarily unavailable" : !snapshot?.actor ? "Connect your field assessments" : "No assessments in view"}</strong><p>{error ? "Live hazard layers remain usable." : !snapshot?.actor ? "Open the existing relocation workspace to sign in and access assessed habitations and sites." : "Pan to an assessed location or add field evidence in the relocation workspace."}</p>{error ? <button onClick={onRetry}>Retry assessments</button> : <Link href="/relocation">Open relocation workspace <ArrowUpRight size={13} /></Link>}</div>}</section>
      <p className="atlas-footnote">Display colors use five bands. Red-zone review and relocation decisions retain the existing workflow rules.</p>
    </div>
  </aside>;
}
