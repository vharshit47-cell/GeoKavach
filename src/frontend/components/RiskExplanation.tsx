"use client";
import type { Habitation } from "@/types/disaster";
import { RISK_STYLES, MODEL_CONFIG } from "@/config/risk";
import { ScoreRing } from "./RiskDonut";
import { RiskClassification } from "./RiskClassification";
export function RiskExplanation({habitation:h}:{habitation:Habitation}){
 const b=h.risk_breakdown;
 const rows=[["Flood Risk",b.flood,"#5cafe4"],["Landslide Risk",b.landslide,"#f26067"],["Cloudburst Risk",b.cloudburst,"#f0cf4e"],["Vulnerability",b.vulnerability,"#b48ae0"],["Disaster History",b.disaster_history,"#72d9b0"]] as const;
 const sum=rows.reduce((n,r)=>n+r[1],0);
 return <section className="explanation-card"><h3>Why is {h.name} {RISK_STYLES[h.risk_category].label}?</h3><p>The risk score reflects the relative contributions of the available assessment factors.</p><div className="explain-ring-layout"><ScoreRing score={h.risk_score} color={RISK_STYLES[h.risk_category].color}/><div className="factor-percent">{rows.map(([label,points,color])=><div key={label}><i style={{background:color}}/><span>{label}</span><strong>{sum?Math.round(points/sum*100):0}%</strong></div>)}</div></div><small>Shares of rounded model contributions; percentages may not total exactly 100%.</small><h3>Key Insights</h3><ul className="key-insights"><li>{h.primary_hazard.toLowerCase()} is the primary assessed hazard.</li><li>{h.past_disasters} past events recorded in the demo dataset.</li><li>{h.elderly_pct+h.children_pct}% children and elderly in the assessed population.</li><li>Road accessibility score: {h.road_access}/100.</li></ul><details><summary>Method & classification</summary><p>Exposure {MODEL_CONFIG.finalRiskWeights.hazard*100}%, vulnerability {MODEL_CONFIG.finalRiskWeights.vulnerability*100}%, history {MODEL_CONFIG.finalRiskWeights.disasterHistory*100}%. Groundwater stress and earthquake exposure are not scored without comparable evidence.</p><RiskClassification/></details></section>;
}

