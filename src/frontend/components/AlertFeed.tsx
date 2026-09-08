"use client";
import { useState } from "react";
import Link from "next/link";
import { TriangleAlert, Radio, Activity, CloudRain, ArrowUpRight } from "lucide-react";
import { useLocationSafety, LocationSafetyManager } from "./LocationSafetyManager";
import { AppShell } from "./AppShell";
import { safeSourceUrl, timeLabel } from "@/frontend/lib/live-data";
import { usePreferences } from "./AppPreferences";
export function AlertFeed({compact=false}:{compact?:boolean}){
 const {data,nationalAlerts,nationalEarthquakes,loading,refresh,location}=useLocationSafety();
 const {language}=usePreferences(); const [filter,setFilter]=useState("All");
 const alerts=data?.alerts??nationalAlerts, earthquakes=data?.earthquakes??nationalEarthquakes;
 const items=[
 ...(alerts?.data??[]).map(a=>({id:a.id,title:a.title,area:a.affectedArea??a.district??a.state??"Coverage not specified",text:a.description,at:a.publishedAt,severity:a.severity,kind:a.hazardType,source:a.source,url:a.sourceUrl})),
 ...(earthquakes?.data??[]).map(q=>({id:q.id,title:`Earthquake · M ${q.magnitude.toFixed(1)}`,area:q.place,text:`Observed event · depth ${q.depthKm.toFixed(1)} km. This is not a prediction.`,at:q.time,severity:"observed",kind:"earthquake",source:q.source,url:q.sourceUrl})),
 ...(!compact?(data?.news.data??[]).map(n=>({id:n.id,title:n.title,area:n.locationLabel,text:"Reported news · not an official warning",at:n.publishedAt??"",severity:"reported",kind:n.hazardType,source:n.source,url:n.sourceUrl})):[])
 ].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)).filter(a=>filter==="All" || filter==="Weather" && ["extreme-weather","cyclone"].includes(a.kind) || a.kind===filter.toLowerCase() || filter==="Cloudburst" && /cloudburst/i.test(a.title));
 const unavailable=!alerts || alerts.status==="unavailable";
 return <section className={compact?"content-card alert-feed":"alert-feed"}><div className="section-title"><h2>{compact?"Recent Alerts":"Disaster Alerts"}</h2>{compact?<Link href="/alerts">View All <ArrowUpRight size={12}/></Link>:<button className="secondary-button" onClick={refresh}>Refresh</button>}</div>{!compact&&<div className="segmented">{["All","Earthquake","Flood","Landslide","Weather","Cloudburst"].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div>}
 {loading&&!items.length?<p className="empty-state">Loading available intelligence…</p>:!items.length?<p className="empty-state">{unavailable?"Live alert data currently unavailable.":"No matching alerts returned."}</p>:<div className="alert-list">{items.slice(0,compact?4:30).map(a=><article key={a.source+a.id} className="alert-row"><span className={`alert-icon ${a.kind}`}>{a.kind==="earthquake"?<Activity size={19}/>:a.kind==="extreme-weather"?<CloudRain size={19}/>:<TriangleAlert size={19}/>}</span><div><h3>{a.title}</h3><p>{a.area}</p>{!compact&&<p>{a.text.slice(0,300)}</p>}<small>{a.source} · {a.severity}</small></div><div className="alert-time"><time>{timeLabel(a.at,language)}</time>{!compact&&safeSourceUrl(a.url)&&<a href={safeSourceUrl(a.url)} target="_blank" rel="noreferrer">Source ↗</a>}</div></article>)}</div>}
 {!loading&&<p className="source-note"><Radio size={11}/> {location?location.name??location.district??"Selected location":"India-wide"} · NDMA {alerts?.status??"unavailable"} · USGS {earthquakes?.status??"unavailable"}</p>}
 {!compact&&<p className="source-note">Absence of an alert does not establish safety. News and observed earthquakes are distinct from official warnings.</p>}
 </section>;
}
export function AlertsPage(){return <AppShell title="Disaster alerts" description="Official warnings, observed earthquakes and reported disaster information."><details className="content-card location-disclosure"><summary>Choose a location for weather and local intelligence</summary><LocationSafetyManager/></details><AlertFeed/></AppShell>;}

