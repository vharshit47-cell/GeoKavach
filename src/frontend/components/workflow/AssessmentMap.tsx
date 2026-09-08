"use client";
import { CircleMarker, MapContainer, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import { risk, type CaseRecord, type SiteRecord } from "@/shared/workflow/model";
function Fit({points}:{points:[number,number][]}){const map=useMap();useEffect(()=>{if(points.length)map.fitBounds(points,{padding:[35,35],maxZoom:12});},[map,points]);return null;}
export default function AssessmentMap({cases,sites,origin,destination}:{cases:CaseRecord[];sites:SiteRecord[];origin?:CaseRecord;destination?:SiteRecord}){
 const points:[number,number][]=[...cases,...sites].map(p=>[p.latitude,p.longitude]);
 return <MapContainer center={[23,80]} zoom={4} style={{height:360,width:"100%"}} scrollWheelZoom={false}><Fit points={points}/><TileLayer attribution='© OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{cases.map(c=><CircleMarker key={c.id} center={[c.latitude,c.longitude]} radius={9} pathOptions={{color:risk(c).redZone?"#f56b6b":"#efbd5a",fillOpacity:.8}}><Popup><strong>{c.name}</strong><p>{risk(c).score}/100 · {risk(c).redZone?"Red-zone review candidate":"Field-assessed habitation"}</p><p>{c.population} people · {c.assessedAt}</p></Popup></CircleMarker>)}{sites.map(s=><CircleMarker key={s.id} center={[s.latitude,s.longitude]} radius={7} pathOptions={{color:"#57dfab",fillOpacity:.7}}><Popup><strong>{s.name}</strong><p>{s.verified?"Officer-verified":"Verification pending"} · {s.assessedAt}</p></Popup></CircleMarker>)}{origin&&destination&&<Polyline positions={[[origin.latitude,origin.longitude],[destination.latitude,destination.longitude]]} pathOptions={{color:"#72b8fa",dashArray:"6 6"}}/>}</MapContainer>;
}
