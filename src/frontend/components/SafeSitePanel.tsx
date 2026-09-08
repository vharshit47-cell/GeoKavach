"use client";
import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import type { SafeSite, Habitation } from "@/types/disaster";
import { siteStatus } from "@/shared/config/assessment";
import { ScoreRing } from "./RiskDonut";
export function SafeSitePanel({site:s,origin,onClose}:{site:SafeSite;origin?:Habitation;onClose:()=>void}){
 const [tab,setTab]=useState("Overview");
 return <aside className="detail-drawer inline-detail" aria-label={s.name+" site details"}><div className="panel-title"><div><h2>{s.name}</h2><p>{s.district}, {s.state}</p></div><button onClick={onClose} className="icon-button" aria-label="Close site"><X size={16}/></button></div><div className="segmented" role="tablist" aria-label="Safe-site details">{["Overview","Infrastructure","Suitability","Capacity"].map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</div>
 {tab==="Overview"&&<dl className="plan-facts">{[["Total Area",s.land_hectares+" hectares"],["Estimated Capacity",s.capacity.toLocaleString("en-IN")+" people"],["Proposed occupancy",s.allocated_population.toLocaleString("en-IN")],["Remaining capacity",s.remaining_capacity.toLocaleString("en-IN")],["Elevation","Not available"],["Distance from primary road","Not available"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
 {tab==="Infrastructure"&&<dl className="plan-facts">{[["Road Access",s.road_score+"/100"],["Water Availability",s.water_score+"/100"],["Healthcare",s.healthcare_score+"/100"],["School",s.education_score+"/100"],["Power Supply","Not verified"],["Communication","Not verified"],["Shelter readiness","Not verified"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
 {tab==="Suitability"&&<><ScoreRing score={s.suitability_score} color="#45df96" label="Suitability"/><p className="source-note">Existing site assessment combines safety, land, water, road access, healthcare and education. Safety score: {s.safety_score}/100.</p></>}
 {tab==="Capacity"&&<><h3>Carrying Capacity Analysis</h3><dl className="plan-facts">{[["Land Availability",s.land_hectares+" ha"],["Water Supply",s.water_score+"/100"],["Food Supply","Not assessed"],["Road Connectivity",s.road_score+"/100"],["Healthcare Access",s.healthcare_score+"/100"],["Education Facilities",s.education_score+"/100"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><div className="destination-card"><span>ESTIMATED CARRYING CAPACITY</span><h2>{s.capacity.toLocaleString("en-IN")} people</h2><p>Land and infrastructure model · factor {s.infrastructure_factor}</p></div><p className="source-note">Infrastructure indicators are scores, not separately measured person-capacities. Food capacity is not assessed. Proposed occupancy: {s.allocated_population.toLocaleString("en-IN")}.</p></>}
 <div className="risk-total safe"><span>Suitability Score<strong>{s.suitability_score} / 100</strong></span><span className="site-status">{siteStatus(s,origin?.population)}</span></div><a className="primary-button full" href={`/relocation${origin?"?habitation="+origin.id:""}`}>Plan relocation <ArrowRight size={15}/></a>
 </aside>;
}

