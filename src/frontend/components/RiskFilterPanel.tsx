"use client";
import { usePreferences } from "./AppPreferences";

import { Check, Filter, LocateFixed, MapPinned } from "lucide-react";
import type { HazardType, RiskCategory } from "@/types/disaster";

const hazards: Array<{ value: HazardType; label: string }> = [
  { value: "LANDSLIDE", label: "Landslide" },
  { value: "FLOOD", label: "Flood" },
  { value: "CLOUDBURST", label: "Cloudburst" },
];

const risks: Array<{ value: RiskCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "RED", label: "Red Zone" },
  { value: "HIGH", label: "High" },
  { value: "MODERATE", label: "Moderate" },
  { value: "SAFE", label: "Safe" },
];

export function RiskFilterPanel({
  activeHazards,
  onHazards,
  risk,
  onRisk,
  minPopulation,
  onMinPopulation,
  relocationOnly,
  onRelocationOnly,
  showSites,
  onShowSites,
}: {
  activeHazards: HazardType[];
  onHazards: (hazards: HazardType[]) => void;
  risk: RiskCategory | "ALL";
  onRisk: (risk: RiskCategory | "ALL") => void;
  minPopulation: number;
  onMinPopulation: (value: number) => void;
  relocationOnly: boolean;
  onRelocationOnly: (value: boolean) => void;
  showSites: boolean;
  onShowSites: (value: boolean) => void;
}) {
  const { tr } = usePreferences();
  const toggleHazard = (hazard: HazardType) => {
    onHazards(activeHazards.includes(hazard) ? activeHazards.filter((item) => item !== hazard) : [...activeHazards, hazard]);
  };
  return (
    <aside className="filter-panel panel-card">
      <div className="panel-heading"><span className="panel-icon"><Filter size={16} /></span><div><span>{tr("MAP CONTROLS")}</span><h2>{tr("Hazard filters")}</h2></div></div>
      <section className="filter-section"><h3>{tr("Hazard layers")}</h3>{hazards.map((item) => <button key={item.value} className={`check-row ${activeHazards.includes(item.value) ? "selected" : ""}`} onClick={() => toggleHazard(item.value)}><span>{activeHazards.includes(item.value) && <Check size={12} />}</span>{tr(item.label)}</button>)}</section>
      <section className="filter-section"><h3>{tr("Risk level")}</h3><div className="risk-filter-grid">{risks.map((item) => <button className={risk === item.value ? "active" : ""} key={item.value} onClick={() => onRisk(item.value)}>{tr(item.label)}</button>)}</div></section>
      <section className="filter-section"><div className="range-label"><h3>{tr("Population threshold")}</h3><strong>{minPopulation === 0 ? tr("Any") : `${minPopulation}+`}</strong></div><input type="range" min="0" max="1000" step="100" value={minPopulation} onChange={(event) => onMinPopulation(Number(event.target.value))} /></section>
      <section className="filter-section compact"><label className="toggle-row"><span><LocateFixed size={15} />{tr("Immediate relocation only")}</span><input type="checkbox" checked={relocationOnly} onChange={(event) => onRelocationOnly(event.target.checked)} /></label><label className="toggle-row"><span><MapPinned size={15} />{tr("Show safe sites")}</span><input type="checkbox" checked={showSites} onChange={(event) => onShowSites(event.target.checked)} /></label></section>
      <p className="filter-note">{tr("Filters use habitation-level hazard scores. GeoJSON hazard polygons can replace these demo layers without changing the interface.")}</p>
    </aside>
  );
}

