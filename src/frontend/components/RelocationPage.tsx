"use client";
import { useEffect, useState } from "react";
import { useSurakshaData } from "@/hooks/use-suraksha-data";
import { rankSafeSites, availableForHabitation } from "@/shared/config/assessment";
import { AppShell } from "./AppShell";
import { RiskBadge } from "./RiskBadge";
import { ErrorState, LoadingState } from "./LoadingState";

export function RelocationPage() {
  const { habitations, safeSites, relocationPlan, loading, error, retry } = useSurakshaData();
  const [id, setId] = useState<number | null>(null);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [generated, setGenerated] = useState(false);
  useEffect(() => { const raw = new URLSearchParams(window.location.search).get("habitation"); if (raw) setId(Number(raw)); }, []);
  const origins = [...habitations].sort((a, b) => b.risk_score - a.risk_score);
  const origin = id === null ? origins[0] : origins.find(h => h.id === id);
  // Release this origin's existing proposal before comparing alternatives; preserve all other allocations.
  const available = origin ? availableForHabitation(origin.id, safeSites, relocationPlan) : [];
  const ranked = origin ? rankSafeSites(origin, available).slice(0, 3) : [];
  const selected = siteId === null ? ranked[0] : ranked.find(r => r.site.id === siteId);
  const reason = selected ? `Ranks candidates by safety, infrastructure, distance and available capacity. Safety ${selected.site.safety_score}/100; capacity accommodates the full population. Shelter readiness and road access require field verification.` : "";
  const download = () => {
    if (!origin || !selected) return;
    const text = ["GEOKAVACH — RELOCATION RECOMMENDATION", "Demo Dataset · provisional; not an evacuation order", "Habitation: " + origin.name, "Population: " + origin.population, "Selected safe site: " + selected.site.name, "Straight-line distance: " + selected.distance.toFixed(1) + " km", "Capacity available: " + selected.site.remaining_capacity, "Capacity after proposal: " + (selected.site.remaining_capacity - origin.population), "Risk: " + origin.risk_score + "/100", "Priority: " + origin.priority_category, "Reason: " + reason].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "relocation-" + origin.id + ".txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <AppShell title="Relocation planner" description="Select a habitation, compare the best available sites, and generate a recommendation.">
    {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={retry} /> : <>
      <section className="content-card planner-origin"><label htmlFor="origin">Habitation requiring relocation</label><select id="origin" value={origin?.id ?? ""} onChange={e => { setId(Number(e.target.value)); setSiteId(null); setGenerated(false); }}><option value="" disabled>Select habitation</option>{origins.map(h => <option key={h.id} value={h.id}>{h.name} · Risk {h.risk_score} · {h.population.toLocaleString("en-IN")} people</option>)}</select>{origin && <RiskBadge value={origin.risk_category} />}</section>
      <div className="section-title"><h2>Top safe-site recommendations</h2><span>Distances are straight-line estimates</span></div>
      {!origin ? <p className="content-card">Select a valid habitation to continue.</p> : !ranked.length ? <p className="content-card">No suitable site has enough available capacity for this habitation. Review additional sites or a split relocation with authorities.</p> : <div className="site-card-grid">{ranked.map((r, i) => <article key={r.site.id} className={`content-card candidate-card ${selected?.site.id === r.site.id ? "selected" : ""}`}><span className="section-kicker">{i === 0 ? "RECOMMENDED SITE" : "ALTERNATIVE " + i}</span><h2>{r.site.name}</h2><dl className="plan-facts"><div><dt>Suitability</dt><dd>{r.site.suitability_score}/100</dd></div><div><dt>Safety</dt><dd>{r.site.safety_score}/100</dd></div><div><dt>Distance</dt><dd>{r.distance.toFixed(1)} km</dd></div><div><dt>Available capacity</dt><dd>{r.site.remaining_capacity.toLocaleString("en-IN")}</dd></div><div><dt>Infrastructure</dt><dd>{Math.min(r.site.water_score, r.site.road_score, r.site.healthcare_score) >= 60 ? "Good" : "Needs review"}</dd></div></dl><button className="secondary-button" aria-pressed={selected?.site.id === r.site.id} onClick={() => { setSiteId(r.site.id); setGenerated(false); }}>{selected?.site.id === r.site.id ? "Selected" : "Select site"}</button></article>)}</div>}
      {origin && selected && <div className="planner-action"><p>Provisional plan. Existing proposals for other habitations are retained. Generating a plan does not reserve capacity.</p><button className="primary-button" onClick={() => setGenerated(true)}>Generate Relocation Plan</button></div>}
      {generated && origin && selected && <section className="content-card generated-plan" aria-live="polite"><span className="section-kicker">RELOCATION RECOMMENDATION · DEMO</span><h2>{origin.name} → {selected.site.name}</h2><dl className="plan-facts"><div><dt>Population requiring relocation</dt><dd>{origin.population.toLocaleString("en-IN")}</dd></div><div><dt>Distance · straight-line</dt><dd>{selected.distance.toFixed(1)} km</dd></div><div><dt>Capacity available</dt><dd>{selected.site.remaining_capacity.toLocaleString("en-IN")}</dd></div><div><dt>Capacity after proposal</dt><dd>{(selected.site.remaining_capacity - origin.population).toLocaleString("en-IN")}</dd></div><div><dt>Priority level</dt><dd>{origin.priority_category}</dd></div></dl><dl className="plan-facts"><div><dt>Estimated Travel Time</dt><dd>Not available</dd></div><div><dt>Route Type</dt><dd>Straight-line screening connection</dd></div></dl><a className="primary-button" href={`/map?habitation=${origin.id}&site=${selected.site.id}`}>View Route on Map →</a><h3>Reason for recommendation</h3><p>{reason}</p><button className="secondary-button" onClick={download}>Download recommendation</button></section>}
    </>}
  </AppShell>;
}

