"use client";
import { RISK_STYLES } from "@/config/risk";
import type { Habitation } from "@/types/disaster";
export function ScoreRing({score,color="#f26067",label="Risk Score"}:{score:number;color?:string;label?:string}){return <div className="score-ring" style={{background:`conic-gradient(${color} ${score}%, var(--line) 0)`}}><div><strong>{score}</strong><span>{label}</span></div></div>;}
export function RiskDonut({habitations}:{habitations:Habitation[]}){
 const rows=(["RED","HIGH","MODERATE","SAFE"] as const).map(category=>({...RISK_STYLES[category],count:habitations.filter(h=>h.risk_category===category).length}));
 let cumulative=0;const stops=rows.map(r=>{const start=cumulative;cumulative+=habitations.length?r.count/habitations.length*100:0;return `${r.color} ${start}% ${cumulative}%`;});
 return <div className="risk-overview"><div className="distribution-ring" style={{background:habitations.length?`conic-gradient(${stops.join(",")})`:"var(--line)"}}><div><strong>{habitations.length}</strong><span>Habitations</span></div></div><div className="donut-legend">{rows.map(r=><div key={r.label}><i style={{background:r.color}}/><span>{r.label}</span><strong>{r.count} <small>({habitations.length?Math.round(r.count/habitations.length*100):0}%)</small></strong></div>)}</div></div>;
}

