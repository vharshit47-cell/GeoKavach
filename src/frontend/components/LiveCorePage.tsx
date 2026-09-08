"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "./AppShell";
import { LocationSafetyManager, useLocationSafety } from "./LocationSafetyManager";
import { WeatherPanel, AlertsPanel, EarthquakesPanel } from "./LiveCards";

import { RiskMapWorkspace } from "./map/RiskMapWorkspace";
export function LiveCorePage({view="weather"}:{view?:"weather"|"map"|"alerts"}){
 const {location,data,nationalAlerts,nationalEarthquakes,loading,error,refresh}=useLocationSafety();
 const [hazard,setHazard]=useState("all");
 if(view==="map") return <RiskMapWorkspace/>;
 const alerts=location?data?.alerts??null:nationalAlerts;
 const visibleAlerts=alerts&&hazard!=="all"?{...alerts,data:alerts.data.filter(a=>a.hazardType===hazard)}:alerts;
 const earthquakes=location?data?.earthquakes??null:nationalEarthquakes;
 const title={weather:"Live Weather",map:"Live Hazard Map",alerts:"Official Alerts & Earthquakes"}[view];
 return <AppShell title={title} description="Real provider data with source timestamps. Refreshes every five minutes; unavailable sources stay unavailable." actions={<button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={14}/>Refresh</button>}><div className="live-dashboard"><LocationSafetyManager/>{error&&<p role="alert">Some sources could not be reached. Try Refresh.</p>}{view==="weather"?<WeatherPanel result={data?.weather??null} loading={loading&&!!location} hasLocation={!!location}/>:<><div className="segmented" aria-label="Hazard filters">{[["all","All Hazards"],["flood","Flood"],["landslide","Landslide"],["earthquake","Earthquake"]].map(([key,label])=><button key={key} aria-pressed={hazard===key} className={hazard===key?"active":""} onClick={()=>setHazard(key)}>{label}</button>)}</div>{hazard!=="earthquake"&&<AlertsPanel result={visibleAlerts} loading={loading} retry={refresh}/>} {(hazard==="all"||hazard==="earthquake")&&<EarthquakesPanel result={earthquakes} loading={loading}/>} {(hazard==="flood"||hazard==="landslide")&&<p className="source-note">Showing official {hazard} warnings in the available feed. No matching warning does not establish safety. Live river-level measurements and landslide susceptibility maps are not connected.</p>}</>}<p className="source-note">Weather: Open-Meteo model forecasts. Earthquakes: USGS observations from the past 24 hours. Alerts: NDMA SACHET. Facilities: OpenStreetMap records, with unverified capacity and opening status.</p></div></AppShell>;
}
