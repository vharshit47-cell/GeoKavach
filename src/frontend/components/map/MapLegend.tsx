import { Clock3 } from "lucide-react";
import { hazardLabel, RISK_SCALE, type MapHazard, type MapMode } from "@/frontend/lib/map/presentation";

export function MapLegend({ hazard, mode }: { hazard: MapHazard; mode: MapMode }) {
  const title = hazard === "all" || hazard === "multi" ? "Multi-Hazard Risk" : hazard === "landslide" ? "Landslide Intensity" : `${hazardLabel(hazard)} Hazard`;
  return <>
    <details className="atlas-legend atlas-glass" open><summary>{mode === "exposure" ? "Population exposure" : mode === "impact" ? "Relocation priority" : title}</summary>
      <div className="atlas-scale">{RISK_SCALE.map(band => <span key={band.label} style={{ background: band.color }} title={band.label} />)}</div>
      <div className="atlas-scale-labels"><span>Very low</span><span>Critical</span></div>
      <p>{hazard === "all" || hazard === "multi" ? "Display bands: 0–20 · 21–40 · 41–60 · 61–80 · 81–100" : "Field intensity: 0–5 · no score for missing evidence"}</p>
      <div className="atlas-legend-symbols"><span><i className="atlas-site-dot" />Assessed site</span><span><i className="atlas-facility-dot" />Reported facility</span></div>
      <p>Assessment bubbles: population / highest score. Warning bubbles: count / provider severity. Quake size: magnitude.</p>
    </details>
    <div className="atlas-timeline atlas-glass" aria-label="Evidence timeline"><Clock3 size={15} /><button disabled title="No historical hazard-risk layer is connected">Historical</button><button className="is-active" aria-pressed="true">Current<span /></button><small>Latest available evidence</small></div>
  </>;
}
