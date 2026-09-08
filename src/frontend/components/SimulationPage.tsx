"use client";
import { usePreferences } from "./AppPreferences";

import { useState } from "react";
import { ArrowRight, CloudRain, Play, Route, ShieldAlert, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { useSurakshaData } from "@/hooks/use-suraksha-data";
import type { SimulationResult } from "@/types/disaster";
import { AppShell } from "./AppShell";
import { ErrorState, LoadingState } from "./LoadingState";
import { RiskBadge } from "./RiskBadge";

function Slider({ label, value, onChange, icon: Icon, detail }: { label: string; value: number; onChange: (value: number) => void; icon: typeof CloudRain; detail: string }) {
  const { tr } = usePreferences();
  return <label className="scenario-control"><span className="scenario-icon"><Icon size={17} /></span><span className="scenario-copy"><strong>{tr(label)}</strong><small>{tr(detail)}</small><input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} /></span><output>{value}</output></label>;
}

export function SimulationPage() {
  const { tr } = usePreferences();
  const { habitations, loading, error, retry } = useSurakshaData();
  const [habitationId, setHabitationId] = useState(1);
  const [rainfall, setRainfall] = useState(85);
  const [roadAccess, setRoadAccess] = useState(40);
  const [vulnerability, setVulnerability] = useState(70);
  const [hazardIntensity, setHazardIntensity] = useState(80);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const runScenario = async () => {
    setRunning(true);
    setSimulationError(null);
    try {
      setResult(await api.simulateRisk({ habitation_id: habitationId, rainfall, road_access: roadAccess, population_vulnerability: vulnerability, hazard_intensity: hazardIntensity }));
    } catch (reason) {
      setSimulationError(reason instanceof Error ? reason.message : "Scenario could not be calculated");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <AppShell title={tr("Scenario Simulator")} description={tr("Test how changing hazard and vulnerability conditions affect modeled risk.")}><LoadingState /></AppShell>;
  if (error) return <AppShell title={tr("Scenario Simulator")} description={tr("Test how changing hazard and vulnerability conditions affect modeled risk.")}><ErrorState message={error} onRetry={retry} /></AppShell>;

  return <AppShell title={tr("Scenario Simulator")} description={tr("Explore a transparent what-if model without making the platform dependent on machine learning.")}>
    <section className="simulation-layout"><div className="content-card simulator-controls"><div className="card-heading"><div><span className="section-kicker">{tr("SCENARIO INPUTS")}</span><h2>{tr("Stress-test a habitation")}</h2><p>{tr("Set conditions from 0 (low) to 100 (severe).")}</p></div></div><label className="habitation-select"><span>{tr("Habitation")}</span><select value={habitationId} onChange={(event) => { setHabitationId(Number(event.target.value)); setResult(null); }}>{habitations.map((item) => <option value={item.id} key={item.id}>{item.name}{tr("· current risk" )}{" "}{item.risk_score}</option>)}</select></label><div className="scenario-controls"><Slider label={tr("Rainfall intensity")} value={rainfall} onChange={setRainfall} icon={CloudRain} detail={tr("Short-duration extreme rainfall pressure")} /><Slider label={tr("Population vulnerability")} value={vulnerability} onChange={setVulnerability} icon={UsersRound} detail={tr("Demographic and response sensitivity")} /><Slider label={tr("Road accessibility")} value={roadAccess} onChange={setRoadAccess} icon={Route} detail={tr("Higher values indicate better access")} /><Slider label={tr("Hazard intensity")} value={hazardIntensity} onChange={setHazardIntensity} icon={ShieldAlert} detail={tr("Combined scenario hazard severity")} /></div><button className="primary-button run-button" onClick={runScenario} disabled={running}><Play size={16} />{running ? tr("Running scenario…") : tr("Run Scenario")}</button>{simulationError && <p className="inline-error">{simulationError}</p>}</div><div className="content-card scenario-result"><div className="card-heading"><div><span className="section-kicker">{tr("MODELED RESULT")}</span><h2>{result ? result.habitation_name : tr("Run a scenario")}</h2><p>{tr("Current assessment compared with projected conditions.")}</p></div></div>{result ? <><div className="risk-comparison"><div><span>{tr("Current risk")}</span><strong>{result.current_risk}<small>/100</small></strong><RiskBadge value={result.current_category} /></div><ArrowRight size={24} /><div><span>{tr("Projected risk")}</span><strong>{result.projected_risk}<small>/100</small></strong><RiskBadge value={result.projected_category} /></div></div><div className="change-callout"><span>{tr("Modeled change")}</span><strong>{result.modeled_change >= 0 ? "+" : ""}{result.modeled_change}{tr("points")}</strong><p>{tr(result.recommendation)}</p></div><div className="assumption-list"><h3>{tr("Model assumptions")}</h3>{result.assumptions.map((item) => <p key={item}>{tr(item)}</p>)}</div></> : <div className="empty-result"><ShieldAlert size={34} /><strong>{tr("No scenario calculated yet")}</strong><p>{tr("Adjust the controls and run the model to compare current and projected risk.")}</p></div>}</div></section>
  </AppShell>;
}

