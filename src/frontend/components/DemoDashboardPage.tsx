"use client";
import { useState } from "react";
import { Home, Siren, UsersRound, Layers3 } from "lucide-react";
import { useSurakshaData } from "@/hooks/use-suraksha-data";
import type { Habitation, HazardType, RiskCategory } from "@/types/disaster";
import { recommendationForHabitation } from "@/shared/config/assessment";
import { AppShell } from "./AppShell";
import { SummaryCard } from "./SummaryCard";
import { SurakshaMap } from "./SurakshaMap";
import { RiskBadge } from "./RiskBadge";
import { HabitationDetailPanel } from "./HabitationDetailPanel";
import { ErrorState, LoadingState } from "./LoadingState";

export function DemoDashboardPage() {
  const { habitations, safeSites, relocationPlan, summary, loading, error, retry } = useSurakshaData();
  const [hazard, setHazard] = useState<HazardType | "ALL">("ALL");
  const [risk, setRisk] = useState<RiskCategory | "ALL">("ALL");
  const [showSites, setShowSites] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [selected, setSelected] = useState<Habitation | null>(null);
  const filtered = habitations.filter(h => (hazard === "ALL" || h.primary_hazard === hazard) && (risk === "ALL" || h.risk_category === risk));
  const priorities = [...habitations].filter(h => h.risk_score > 50).sort((a,b) => b.risk_score - a.risk_score || b.priority_score - a.priority_score).slice(0,3);
  const plan = (h: Habitation) => { window.location.href = `/relocation?habitation=${h.id}`; };
  return <AppShell title="Risk command center" description="Identify vulnerable habitations. Understand the risk. Plan a safer relocation." actions={<span className="method-chip">SIH26191 · Chamoli, Uttarakhand</span>}>
    {loading ? <LoadingState /> : error || !summary ? <ErrorState message={error || "Assessment unavailable"} onRetry={retry} /> : <>
      <section className="kpi-grid command-kpis">
        <SummaryCard label="Critical Habitations" value={summary.red_zones.toString()} detail="Risk score 76–100 / 100" icon={Siren} tone="red" />
        <SummaryCard label="Population at Risk" value={summary.population_at_risk.toLocaleString("en-IN")} detail="Critical and high-risk habitations" icon={UsersRound} tone="orange" />
        <SummaryCard label="Active Red Zones" value={String(summary.hazard_zones)} detail="Demo hazard areas · not live warnings" icon={Layers3} tone="red" />
        <SummaryCard label="Available Safe-Site Capacity" value={safeSites.reduce((n,s) => n+s.remaining_capacity,0).toLocaleString("en-IN")} detail="After proposed allocations · estimated" icon={Home} tone="green" />
      </section>
      <section className="priority-section"><div className="section-title"><h2>Priority Relocation</h2><a href="/habitations">View all habitations →</a></div><div className="priority-grid">{priorities.map((h,i) => <article className="priority-item" key={h.id}><span className="priority-number">0{i+1}</span><div><h3>{h.name}</h3><p>{h.population.toLocaleString("en-IN")} people · <span className="capitalize">{h.primary_hazard.toLowerCase()}</span></p></div><div className="priority-risk"><strong>{h.risk_score}<small>/100</small></strong><RiskBadge value={h.risk_category} /></div><button className="secondary-button" onClick={() => { setSelected(h); document.getElementById("assessment-map")?.scrollIntoView({behavior:"smooth", block:"start"}); }}>View Details</button></article>)}</div>{!priorities.length && <p>No high-risk habitations in this dataset.</p>}</section>
      <section id="assessment-map" className={`command-map-layout ${selected ? "has-selection" : ""}`}>
        <div className="map-card"><div className="map-card-heading"><div><span className="section-kicker">HAZARD & RELOCATION GIS</span><h2>Habitation risk overview</h2><p>{filtered.length} of {habitations.length} habitations · select a marker to assess</p></div></div>
          <div className="command-filters"><label>Hazard Type<select value={hazard} onChange={e => setHazard(e.target.value as typeof hazard)}><option value="ALL">All hazards</option><option value="FLOOD">Flood</option><option value="LANDSLIDE">Landslide</option><option value="CLOUDBURST">Cloudburst</option></select></label><label>Risk Level<select value={risk} onChange={e => setRisk(e.target.value as typeof risk)}><option value="ALL">All levels</option><option value="RED">Critical</option><option value="HIGH">High</option><option value="MODERATE">Moderate</option><option value="SAFE">Low</option></select></label><label className="toggle-label"><input type="checkbox" checked={showZones} onChange={e => setShowZones(e.target.checked)} />Red Zones</label><label className="toggle-label"><input type="checkbox" checked={showSites} onChange={e => setShowSites(e.target.checked)} />Safe Sites</label></div>
          <div className="command-map-stage"><SurakshaMap habitations={filtered} safeSites={safeSites} showSites={showSites} showZones={showZones} hazard={hazard} selectedHabitation={selected} selectedPlan={null} onHabitation={setSelected} onRelocation={plan} />{!filtered.length && <div className="map-empty">No habitations match these filters.</div>}<div className="map-legend"><span><i className="red" />Critical / Red Zone</span><span><i className="high" />High</span><span><i className="moderate" />Moderate</span><span><i className="site" />Safe Site</span></div></div>
        </div>
        {selected && <HabitationDetailPanel inline habitation={selected} recommendation={recommendationForHabitation(selected, safeSites, relocationPlan)} onClose={() => setSelected(null)} onFindRelocation={() => plan(selected)} />}
      </section>
    </>}
  </AppShell>;
}

