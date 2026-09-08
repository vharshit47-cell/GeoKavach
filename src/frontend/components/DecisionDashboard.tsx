"use client";
import { useState } from "react";
import Link from "next/link";
import { Siren, UsersRound, Layers3, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useSurakshaData } from "@/hooks/use-suraksha-data";
import { RISK_BANDS } from "@/config/risk";
import { AppShell } from "./AppShell";
import { SummaryCard } from "./SummaryCard";
import { RiskDonut } from "./RiskDonut";
import { AlertFeed } from "./AlertFeed";
import { RiskBadge } from "./RiskBadge";
import { ErrorState, LoadingState } from "./LoadingState";
export function DecisionDashboard(){
 const {habitations,summary,safeSites,loading,error,retry}=useSurakshaData();
 const [state,setState]=useState("ALL"),[district,setDistrict]=useState("ALL"),[year,setYear]=useState("ALL");
 const filtered=habitations.filter(h=>(state==="ALL"||h.state===state)&&(district==="ALL"||h.district===district)&&(year==="ALL"||h.last_updated.startsWith(year)));
 const sites=safeSites.filter(s=>(state==="ALL"||s.state===state)&&(district==="ALL"||s.district===district)&&(year==="ALL"||s.last_updated.startsWith(year)));
 const top=[...filtered].sort((a,b)=>b.risk_score-a.risk_score).slice(0,3);
 const filters=<div className="dashboard-filters"><select aria-label="State or region" value={state} onChange={e=>{setState(e.target.value);setDistrict("ALL");}}><option value="ALL">All regions</option>{[...new Set(habitations.map(h=>h.state))].map(s=><option key={s}>{s}</option>)}</select><select aria-label="District" value={district} onChange={e=>setDistrict(e.target.value)}><option value="ALL">All districts</option>{[...new Set(habitations.filter(h=>state==="ALL"||h.state===state).map(h=>h.district))].map(s=><option key={s}>{s}</option>)}</select><select aria-label="Dataset year" value={year} onChange={e=>setYear(e.target.value)}><option value="ALL">All releases</option>{[...new Set(habitations.map(h=>h.last_updated.slice(0,4)))].map(y=><option key={y} value={y}>Year: {y}</option>)}</select></div>;
 return <AppShell title="Decision Dashboard" description="Key insights for a safer and more resilient tomorrow." actions={filters}>{loading?<LoadingState/>:error||!summary?<ErrorState message={error??"Assessment unavailable"} onRetry={retry}/>:<>
 <section className="kpi-grid command-kpis"><SummaryCard label="Critical Habitations" value={String(filtered.filter(h=>h.risk_category==="RED").length)} detail={`Risk score ${RISK_BANDS[3].min}–100`} icon={Siren} tone="red"/><SummaryCard label="Population at Risk" value={filtered.filter(h=>["RED","HIGH"].includes(h.risk_category)).reduce((n,h)=>n+h.population,0).toLocaleString("en-IN")} detail="High and critical exposure" icon={UsersRound} tone="orange"/><SummaryCard label="Active Red Zones" value={String(filtered.length?summary.hazard_zones:0)} detail="Demo hazard polygons · not live" icon={Layers3} tone="red"/><SummaryCard label="Available Safe Capacity" value={sites.reduce((n,s)=>n+s.remaining_capacity,0).toLocaleString("en-IN")} detail={`Across ${sites.length} assessed sites`} icon={ShieldCheck} tone="green"/></section>
 <section className="decision-grid"><div className="content-card"><div className="section-title"><h2>Risk Overview</h2><span>Dataset classification</span></div><RiskDonut habitations={filtered}/></div><AlertFeed compact/></section>
 <section className="content-card dashboard-priorities"><div className="section-title"><h2>Priority habitations</h2><Link href="/habitations">View priority list <ArrowUpRight size={12}/></Link></div>{top.map((h,i)=><Link className="priority-line" key={h.id} href={`/map?habitation=${h.id}`}><span className="rank-number">0{i+1}</span><strong>{h.name}<small>{h.district}</small></strong><span>{h.population.toLocaleString("en-IN")} people</span><span>{h.risk_score}/100</span><RiskBadge value={h.risk_category}/><ArrowUpRight size={16}/></Link>)}{!top.length&&<p>No habitations match the selected coverage.</p>}</section>
 <div className="dashboard-next"><div><span className="section-kicker">FROM INSIGHT TO ACTION</span><h2>See the risk. Plan the response.</h2><p>Explore hazard areas, compare safe sites and assess relocation needs.</p></div><Link href="/map" className="primary-button">Open GIS workspace <ArrowUpRight size={16}/></Link></div>
 </>}</AppShell>;
}

