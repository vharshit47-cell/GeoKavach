"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { dominantHazards, relocationDecision } from "@/config/relocation";
import { risk, type CaseRecord, type Role } from "@/shared/workflow/model";
import type { RelocationPlan, SafeSiteCandidate } from "@/types/relocation";

const PlanMap = dynamic(() => import("./RelocationPlanMap"), { ssr: false, loading: () => <p>Loading relocation map…</p> });
const stages = ["Finding safe sites…", "Evaluating candidate safety…", "Checking verified capacity…", "Calculating road routes…", "Generating relocation plan…"];
const formatKm = (metres?: number) => metres == null ? "Data unavailable" : `${(metres / 1000).toFixed(1)} km`;
const formatTime = (seconds?: number) => seconds == null ? "Data unavailable" : `${Math.max(1, Math.round(seconds / 60))} min`;
const capacityText = (site?: SafeSiteCandidate) => site?.availableCapacity == null ? "Capacity not verified" : `${site.availableCapacity.toLocaleString("en-IN")} available`;

export function RelocationPlanner({ caseRecord, role, busy, offline, onPropose }: { caseRecord: CaseRecord; role?: Role; busy: boolean; offline: boolean; onPropose: (siteId: string) => Promise<void> }) {
  const assessment = risk(caseRecord);
  const initialDecision = relocationDecision(assessment.score, caseRecord);
  const [plan, setPlan] = useState<RelocationPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>();
  useEffect(() => { setPlan(null); setError(""); setSelectedSiteId(undefined); }, [caseRecord.id]);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStage(value => Math.min(value + 1, stages.length - 1)), 1100);
    return () => window.clearInterval(timer);
  }, [loading]);

  const generate = async () => {
    setLoading(true); setStage(0); setError("");
    try {
      const response = await fetch("/api/relocation-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ habitationId: caseRecord.id }), signal: AbortSignal.timeout(45_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Relocation plan unavailable");
      setPlan(result);
      setSelectedSiteId(result.assignments[0]?.siteId ?? result.candidates[0]?.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Relocation planning failed"); }
    finally { setLoading(false); }
  };

  const selectedSite = plan?.candidates.find(site => site.id === selectedSiteId);
  const selectedAssignment = plan?.assignments.find(item => item.siteId === selectedSiteId);
  const recommendedId = plan?.candidates.find(site => site.eligible)?.id;
  const selectedRoute = selectedAssignment?.route;
  const hazards = dominantHazards(caseRecord);
  const canSubmitSingleSite = !!plan && plan.assignments.length === 1 && plan.allocatedPopulation === caseRecord.population && selectedAssignment?.siteId === recommendedId;

  return <div className="wf-plan-workspace">
    <section className="content-card wf-card wf-assessment-summary">
      <div><span className="section-kicker">RELOCATION ASSESSMENT</span><h2>{caseRecord.name}</h2><p>{caseRecord.latitude.toFixed(5)}, {caseRecord.longitude.toFixed(5)} · District: Data unavailable · State: Data unavailable</p></div>
      <dl className="wf-plan-facts"><div><dt>Population</dt><dd>{caseRecord.population.toLocaleString("en-IN")}</dd></div><div><dt>Risk</dt><dd>{assessment.score}/100 · {assessment.category}</dd></div><div><dt>Main hazard</dt><dd>{hazards.length ? hazards.join(", ") : "Data unavailable"}</dd></div><div><dt>Relocation</dt><dd>{initialDecision.recommendation}</dd></div></dl>
      <div className="wf-decision"><strong>Priority {initialDecision.priority === "IMMEDIATE" ? "P1" : initialDecision.priority === "PREPARE" ? "P2" : initialDecision.priority === "MONITOR" ? "P3" : "P4"}</strong><ul>{initialDecision.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
      <button className="primary-button" disabled={loading || offline} onClick={() => void generate()}>{plan ? "Recalculate Plan" : "Assess Relocation"}</button>
    </section>

    {loading && <section className="content-card wf-card wf-loading" role="status"><span className="wf-spinner" /> <strong>{stages[stage]}</strong><p>Real providers can take a few seconds. The map remains available.</p></section>}
    {error && <p className="wf-warning" role="alert">{error}</p>}

    {plan && <>
      <nav className="wf-plan-steps" aria-label="Relocation plan progress"><span className="done">1. Assessment</span><span className="done">2. Safe sites</span><span className={plan.assignments.some(item => item.route) ? "done" : "pending"}>3. Route</span><span className="done">4. Relocation plan</span></nav>
      <section className="content-card wf-map-shell"><div className="wf-map-heading"><div><span className="section-kicker">ROAD ROUTES & CANDIDATES</span><h2>Relocation map</h2></div><p>Red: habitation · green: eligible site · gray: unverified/rejected · blue/violet: road route</p></div><PlanMap plan={plan} selectedSiteId={selectedSiteId} onSelect={setSelectedSiteId} /></section>

      <section><div className="section-title"><h2>Safe-site assessment</h2><span>{plan.searchRadiusKm} km search radius · {plan.candidates.length} candidates</span></div>
        {!plan.candidates.length && <p className="content-card wf-card">No candidate safe sites were returned within the current search radius.</p>}
        <div className="wf-site-grid">{plan.candidates.map(site => <article key={site.id} className={`content-card wf-card ${site.eligible ? "wf-eligible" : "wf-excluded"} ${selectedSiteId === site.id ? "wf-selected-site" : ""}`}>
          <span className="section-kicker">{site.id === recommendedId ? "RECOMMENDED" : site.eligible ? "ELIGIBLE CANDIDATE" : "CANDIDATE — NOT ELIGIBLE"}</span><h3>{site.name}</h3>
          <dl className="wf-plan-facts"><div><dt>Suitability</dt><dd>{site.suitabilityScore == null ? "Not scored" : `${site.suitabilityScore}/100`}</dd></div><div><dt>Capacity</dt><dd>{capacityText(site)}</dd></div><div><dt>Screening distance</dt><dd>{site.straightLineDistanceKm.toFixed(1)} km</dd></div><div><dt>Confidence</dt><dd>{site.confidence}</dd></div></dl>
          <ul>{site.reasons.map(reason => <li key={reason}>{reason}</li>)}{site.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
          <div className="wf-actions"><button className="secondary-button" onClick={() => setSelectedSiteId(site.id)}>Show on map</button>{site.sourceUrl && <a className="secondary-button" href={site.sourceUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a>}</div>
          <p className="source-note">Source: {site.source}</p>
        </article>)}</div>
      </section>

      <section className="content-card wf-card"><span className="section-kicker">FINAL RELOCATION PLAN</span><h2>{plan.habitation.name}</h2>
        <dl className="wf-plan-facts"><div><dt>Population to relocate</dt><dd>{plan.habitation.population.toLocaleString("en-IN")}</dd></div><div><dt>Allocated</dt><dd>{plan.allocatedPopulation.toLocaleString("en-IN")}</dd></div><div><dt>Unallocated</dt><dd>{plan.unallocatedPopulation.toLocaleString("en-IN")}</dd></div><div><dt>Decision</dt><dd>{plan.decision.recommendation}</dd></div></dl>
        {plan.warnings.map(warning => <p className="wf-warning" key={warning}>{warning}</p>)}
        <div className="wf-assignment-grid">{plan.assignments.map((assignment, index) => { const site = plan.candidates.find(item => item.id === assignment.siteId)!; return <button type="button" className={selectedSiteId === site.id ? "active" : ""} key={site.id} onClick={() => setSelectedSiteId(site.id)}><span>Route {String.fromCharCode(65 + index)}</span><strong>{site.name}</strong><small>{assignment.allocatedPopulation.toLocaleString("en-IN")} people · {formatKm(assignment.route?.distanceMeters)} · {formatTime(assignment.route?.durationSeconds)}</small></button>; })}</div>
        {!plan.assignments.length && <p>No verified destination could be automatically recommended. Review the rejected/OSM candidates and complete a field safety and capacity assessment.</p>}
        {role === "officer" && canSubmitSingleSite && <button className="primary-button" disabled={busy || offline} onClick={() => void onPropose(recommendedId!)}>Submit single-site plan for approval</button>}
      </section>

      {selectedSite && <section className="content-card wf-card"><span className="section-kicker">RELOCATION GUIDANCE</span><h2>{selectedSite.name}</h2>
        <dl className="wf-plan-facts"><div><dt>Assigned population</dt><dd>{selectedAssignment ? selectedAssignment.allocatedPopulation.toLocaleString("en-IN") : "Not assigned"}</dd></div><div><dt>Verified capacity</dt><dd>{capacityText(selectedSite)}</dd></div><div><dt>Road distance</dt><dd>{formatKm(selectedRoute?.distanceMeters)}</dd></div><div><dt>Estimated travel time</dt><dd>{formatTime(selectedRoute?.durationSeconds)}</dd></div><div><dt>Route provider</dt><dd>{selectedRoute?.provider ?? "Route currently unavailable"}</dd></div><div><dt>Transport profile</dt><dd>{selectedRoute ? "Driving road route" : "Data unavailable"}</dd></div></dl>
        {selectedAssignment?.routeError && <p className="wf-warning">{selectedAssignment.routeError}. Route currently unavailable.</p>}
        {selectedRoute?.warnings.map(warning => <p className={warning.startsWith("WARNING") ? "wf-warning" : "source-note"} key={warning}>{warning}</p>)}
        <h3>Route directions</h3>{selectedRoute?.steps.length ? <ol className="wf-directions">{selectedRoute.steps.map((step, index) => <li key={`${index}-${step.instruction}`}><span>{index + 1}</span><div>{step.instruction}<small>{formatKm(step.distanceMeters)} · {formatTime(step.durationSeconds)}</small></div></li>)}</ol> : <p>Route instructions are currently unavailable.</p>}
        <h3>Standard community safety guidance</h3><ul><li>Follow instructions issued by district and disaster-management authorities.</li><li>Carry essential medicines, identification documents and drinking water when evacuation is ordered.</li><li>Assist children, older people and persons with disabilities.</li><li>Do not enter roads or areas officially marked unsafe.</li><li>Do not return until authorities declare the area safe.</li></ul>
        <p className="wf-safety-note">Decision-support guidance only. Final evacuation and relocation decisions must follow authorized disaster-management and local-government instructions.</p>
      </section>}

      <details className="content-card wf-card"><summary>Data sources and limitations</summary><ul>{plan.dataSources.map(source => <li key={source}>{source}</li>)}</ul><p>OSM facilities are candidates, not verified shelters. “No intersection detected” only covers currently available official alert geometry; it is not a guarantee that a route is safe or open.</p></details>
    </>}
  </div>;
}
