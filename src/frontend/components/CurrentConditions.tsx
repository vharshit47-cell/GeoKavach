"use client";
import { useEffect, useState } from "react";
import type { Habitation } from "@/types/disaster";
import type { LocationIntelligence } from "@/types/intelligence";
export function CurrentConditions({ habitation: h }: { habitation: Habitation }) {
 const [data,setData] = useState<LocationIntelligence | null>(null);
 const [status,setStatus] = useState("Loading current conditions…");
 useEffect(() => {
  let active = true;
  const controller = new AbortController();
  setData(null); setStatus("Loading current conditions…");
  const timeout = setTimeout(() => controller.abort(), 45000);
  const params = new URLSearchParams({lat:String(h.latitude),lon:String(h.longitude),district:h.district,state:h.state});
  fetch("/api/location-risk?"+params,{signal:controller.signal}).then(r => { if(!r.ok) throw new Error(); return r.json(); }).then((d:LocationIntelligence) => { if(active && !controller.signal.aborted) {setData(d);setStatus("");} }).catch(() => { if(active) setStatus("Live data currently unavailable."); }).finally(() => clearTimeout(timeout));
  return () => { active = false; controller.abort(); clearTimeout(timeout); };
 },[h.id,h.latitude,h.longitude,h.district,h.state]);
 return <section className="conditions-panel"><h3>Current Conditions</h3>{!data ? <p role="status">{status}</p> : <><div className="factor-list">
 <div><span>Weather estimate</span><strong>{data.weather.status === "unavailable" || data.weather.data?.temperatureC == null ? "Unavailable" : data.weather.data.temperatureC+" °C"}</strong></div>
 <div><span>Earthquake activity · 100 km</span><strong>{data.earthquakes.status === "unavailable" ? "Unavailable" : data.earthquakes.data.length+" recent events"}</strong></div>
 <div><span>Groundwater · historical</span><strong>{data.groundwater.status === "unavailable" || !data.groundwater.data ? "Unavailable" : data.groundwater.data.totalStations+" stations"}</strong></div></div>
 <p>{data.alerts.status === "unavailable" ? "Official alerts currently unavailable." : data.alerts.data[0]?.title ?? "No matching alerts returned; this does not establish safety."}</p>
 <small>{[data.weather,data.earthquakes,data.groundwater,data.alerts].map(s => s.source+" · "+s.status).join(" / ")}</small><p>Context only; does not change the demo risk score.</p></>}</section>;
}

