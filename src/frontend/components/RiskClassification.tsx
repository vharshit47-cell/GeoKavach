import { RISK_BANDS, RISK_STYLES } from "@/config/risk";
export function RiskClassification(){return <section className="classification"><h3>Classification Criteria</h3>{RISK_BANDS.map(b=><div key={b.category} className="classification-row"><i style={{background:RISK_STYLES[b.category].color}}/><div><strong>{RISK_STYLES[b.category].label}</strong><span>Score {b.min}–{b.max}</span><p>{b.description}</p></div></div>)}</section>;}

