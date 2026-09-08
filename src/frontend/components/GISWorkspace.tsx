"use client";
import { useEffect, useState } from "react";
import { Search, RotateCcw, Layers3, ArrowRight, LocateFixed } from "lucide-react";
import { useSurakshaData } from "@/hooks/use-suraksha-data";
import type { Habitation, SafeSite, RelocationRecommendation } from "@/types/disaster";
import { recommendationForHabitation, availableForHabitation, rankSafeSites } from "@/shared/config/assessment";
import { useLocationSafety } from "./LocationSafetyManager";
import { AppShell } from "./AppShell";
import { SurakshaMap } from "./SurakshaMap";
import { HabitationDetailPanel } from "./HabitationDetailPanel";
import { SafeSitePanel } from "./SafeSitePanel";
import { ErrorState, LoadingState } from "./LoadingState";
import { RiskBadge } from "./RiskBadge";
const hazards=[["FLOOD","Flood"],["LANDSLIDE","Landslide"],["CLOUDBURST","Cloudburst"]];
export function GISWorkspace({mode="map"}:{mode?:"map"|"zones"|"sites"}){
 const { location, locateOnce, locating, locationMessage } = useLocationSafety();
 const [focusCurrent, setFocusCurrent] = useState(false);
 const {habitations,safeSites,relocationPlan,summary,loading,error,retry}=useSurakshaData();
 const [search,setSearch]=useState(""),[hazard,setHazard]=useState("ALL");
 const [active,setActive]=useState(["FLOOD","LANDSLIDE","CLOUDBURST"]);
 const [showHomes,setShowHomes]=useState(mode!=="sites"),[showSites,setShowSites]=useState(true),[showZones,setShowZones]=useState(mode!=="sites"),[boundary,setBoundary]=useState(true);
 const [basemap,setBasemap]=useState<"street"|"satellite">("satellite");
 const [homeId,setHomeId]=useState<number|null>(null),[siteId,setSiteId]=useState<number|null>(null),[routeSite,setRouteSite]=useState<number|null>(null);
 useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("habitation"))setHomeId(Number(p.get("habitation")));if(p.get("site")){setRouteSite(Number(p.get("site")));setShowSites(true);}},[]);
 const home=habitations.find(h=>h.id===homeId)??null,site=safeSites.find(s=>s.id===siteId)??null;
 const filtered=habitations.filter(h=>(hazard==="ALL"||h.primary_hazard===hazard) && (!search||`${h.name} ${h.district} ${h.state}`.toLowerCase().includes(search.toLowerCase())));
 const matchingSites=safeSites.filter(s=>!search||`${s.name} ${s.district}`.toLowerCase().includes(search.toLowerCase()));
 const top=[...filtered].sort((a,b)=>b.risk_score-a.risk_score).slice(0,5);
 const recommendation=home?recommendationForHabitation(home,safeSites,relocationPlan):null;
 let route:RelocationRecommendation|null=null;
 if(home&&routeSite&&recommendation){
  const match=rankSafeSites(home,availableForHabitation(home.id,safeSites,relocationPlan)).find(r=>r.site.id===routeSite);
  if(match)route={...recommendation,site_id:match.site.id,site_name:match.site.name,site_latitude:match.site.latitude,site_longitude:match.site.longitude,distance_km:Number(match.distance.toFixed(1)),suitability_score:match.site.suitability_score,remaining_capacity_after:match.site.remaining_capacity-home.population};
 }
 const selectHome=(h:Habitation)=>{setHomeId(h.id);setSiteId(null);setRouteSite(null);};
 const selectSite=(s:SafeSite)=>{setSiteId(s.id);setRouteSite(null);};
 const relocation=()=>{window.location.href=`/relocation${home?"?habitation="+home.id:""}`;};
 const toggle=(h:string)=>setActive(v=>v.includes(h)?v.filter(x=>x!==h):[...v,h]);
 return <AppShell title={mode==="zones"?"Multi-Hazard Red Zones":mode==="sites"?"Safe-Site Identification":"Interactive GIS Risk Map"} description="Explore exposure, understand vulnerability and find capacity-checked relocation sites." actions={<span className="method-chip">CHAMOLI · UTTARAKHAND</span>}>
 {loading?<LoadingState/>:error?<ErrorState message={error} onRetry={retry}/>:<>
 <div className="hazard-tabs segmented"><button className={hazard==="ALL"?"active":""} onClick={()=>{setHazard("ALL");setShowZones(true);}}>All Hazards</button>{hazards.map(([key,label])=><button key={key} className={hazard===key?"active":""} onClick={()=>{setHazard(key);setShowZones(true);if(!active.includes(key))toggle(key);}}>{label}</button>)}<button disabled title="No assessed earthquake polygons in this dataset">Earthquake · unavailable</button><button disabled title="No coastal erosion data in this district dataset">Coastal Erosion · unavailable</button></div>
 <section className={`gis-workspace ${home||site||mode==="zones"?"with-panel":""}`}>
 <aside className="layer-panel content-card"><details open><summary><Layers3 size={16}/>Layers</summary><div><h4>{mode==="sites"?"SAFE-SITE LAYERS":"HAZARDS"}</h4><label><input type="checkbox" checked={showHomes} onChange={e=>setShowHomes(e.target.checked)}/>{mode==="sites"?"Existing Settlements":"Habitations"}</label><label><input type="checkbox" checked={showZones} onChange={e=>setShowZones(e.target.checked)}/>Multi-Hazard Zones</label>{hazards.map(([key,label])=><label key={key}><input type="checkbox" checked={active.includes(key)} onChange={()=>toggle(key)}/>{label} Risk</label>)}<label className="unavailable"><input type="checkbox" disabled/>Earthquake Risk <small>Unavailable</small></label><label className="unavailable"><input type="checkbox" disabled/>Coastal Erosion <small>Unavailable</small></label><label><input type="checkbox" checked={showSites} onChange={e=>setShowSites(e.target.checked)}/>{mode==="sites"?"Proposed Safe Sites":"Safe Sites"}</label><label><input type="checkbox" checked={boundary} onChange={e=>setBoundary(e.target.checked)}/>Administrative Boundaries</label>{mode==="sites"&&<p className="source-note">Infrastructure and road accessibility scores are available in each site's detail panel. Separate geographic layers are unavailable.</p>}<h4>BASE MAP</h4><div className="segmented"><button className={basemap==="satellite"?"active":""} onClick={()=>setBasemap("satellite")}>Satellite</button><button className={basemap==="street"?"active":""} onClick={()=>setBasemap("street")}>Street</button></div><p className="source-note">Imagery is a basemap, not live disaster evidence.</p></div></details><div className="layer-summary"><strong>{mode==="sites"?safeSites.length:habitations.length}</strong><span>{mode==="sites"?"Potential Safe Sites":"Assessed habitations"}</span><small>Chamoli demo coverage</small></div><button className="primary-button full" onClick={relocation}>{mode==="sites"?"Find Best Sites":"Plan Relocation"}<ArrowRight size={14}/></button></aside>
 <div className="gis-stage"><div className="gis-search"><Search size={16}/><input aria-label="Search location, village or district" placeholder="Search location, village or district..." value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label="Use current location" disabled={locating} onClick={()=>{setFocusCurrent(true);locateOnce();}}><LocateFixed size={16}/></button><button aria-label="Reset view" onClick={()=>{setSearch("");setFocusCurrent(false);setHomeId(null);setSiteId(null);setRouteSite(null);window.dispatchEvent(new CustomEvent("suraksha-map-command",{detail:"home"}));}}><RotateCcw size={16}/></button></div>
 {focusCurrent&&locationMessage&&<p className="geo-message" role="status">{locationMessage}</p>}
 {search&&<div className="map-search-results">{filtered.slice(0,4).map(h=><button key={h.id} onClick={()=>{selectHome(h);setSearch("");}}>{h.name}<small>{h.district}</small></button>)}{matchingSites.slice(0,3).map(s=><button key={"s"+s.id} onClick={()=>{selectSite(s);setSearch("");}}>{s.name}<small>Safe site</small></button>)}{!filtered.length&&!matchingSites.length&&<p>No matching locations in this dataset.</p>}</div>}
 <SurakshaMap focusPoint={focusCurrent?location:null} habitations={showHomes?filtered:[]} safeSites={matchingSites} showSites={showSites} showZones={showZones} showBoundary={boundary} basemap={basemap} activeHazards={active} hazard={hazard} selectedHabitation={route?null:home} selectedSite={site} selectedPlan={route} onHabitation={selectHome} onRelocation={relocation} onSite={selectSite}/>
 <div className="map-legend"><span><i className="safe"/>Safe</span><span><i className="moderate"/>Moderate</span><span><i className="high"/>High</span><span><i className="red"/>Critical</span><span><i className="site"/>Safe Site</span></div>{route&&<div className="route-strip"><strong>{route.habitation_name} → {route.site_name}</strong><span>{route.distance_km} km · straight-line connection, not a road route</span></div>}
 </div>
 {site?<SafeSitePanel key={site.id} site={site} origin={home??undefined} onClose={()=>setSiteId(null)}/>:home?<HabitationDetailPanel key={home.id} inline habitation={home} recommendation={recommendation} onClose={()=>{setHomeId(null);setRouteSite(null);}} onFindRelocation={relocation}/>:mode==="zones"?<aside className="content-card zone-analysis"><h2>Multi-Hazard Analysis</h2><p>Screening exposure from the demonstration dataset.</p><div className="zone-stat"><strong>{summary?.hazard_zones ?? "Unavailable"}</strong><span>Hazard zones in dataset</span></div><div className="zone-stat"><strong>{filtered.filter(h=>h.risk_score>50).length}</strong><span>High-risk habitations</span></div><div className="zone-stat"><strong>{filtered.filter(h=>h.risk_score>50).reduce((n,h)=>n+h.population,0).toLocaleString("en-IN")}</strong><span>Population at risk</span></div><h3>Top Affected Areas</h3>{top.map((h,i)=><button className="affected-row" key={h.id} onClick={()=>selectHome(h)}><span>{i+1}. {h.name}</span><RiskBadge value={h.risk_category}/></button>)}</aside>:null}
 </section></>}
 </AppShell>;
}

