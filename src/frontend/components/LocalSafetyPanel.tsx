"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, LocateFixed, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { LocationSafetyManager, useLocationSafety } from "./LocationSafetyManager";
import { usePreferences } from "./AppPreferences";
import { useMapWorkflow } from "./map/useMapData";
import { nearbyRelocationSites } from "@/shared/safety";
import { directions } from "@/shared/workflow/model";

function LocalResults() {
  const { location, data, loading, error } = useLocationSafety();
  const workflow = useMapWorkflow();
  if (!location) return null;
  const sites = workflow.snapshot ? nearbyRelocationSites(location, workflow.snapshot).slice(0, 3) : [];
  const facilities = data?.facilities.status === "unavailable" ? [] : [...(data?.facilities.data ?? [])].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  const official = data?.alerts.status === "live" || data?.alerts.status === "cached" ? data.alerts.data.filter(a => a.active && a.action).slice(0, 2) : [];
  return <div className="local-safety-grid">
    <article><h3><ShieldCheck size={18} />What to do nearby</h3>{loading ? <p role="status">Checking local warnings and conditions…</p> : error || !data ? <p>Local guidance is unavailable. Check official warnings and local authority instructions.</p> : <>{official.map(a => <div className="local-official-action" key={a.id}><strong>{a.title}</strong><p>{a.action}</p></div>)}{!official.length && <p>No location-specific action instructions were returned by the official feed.</p>}<ul>{data.risk.recommendedActions.slice(0, 3).map(action => <li key={action}>{action}</li>)}</ul><small>General decision support · follow official directions first</small></>}<Link href="/alerts">View official alerts <ArrowUpRight size={14} /></Link></article>
    <article><h3><MapPin size={18} />Nearby help</h3>{loading ? <p>Finding facilities near your location…</p> : !facilities.length ? <p>{data?.facilities.status === "unavailable" || error ? "Nearby-place lookup is unavailable." : "No nearby facilities were returned."}</p> : facilities.map(site => <a className="local-place" key={site.id} href={directions(location, site)} target="_blank" rel="noreferrer"><span><strong>{site.name}</strong><small>{site.type.replaceAll("_", " ")} · {site.distanceKm.toFixed(1)} km away</small></span><ArrowUpRight size={15} /></a>)}<small>OpenStreetMap records. Opening, access and shelter suitability are unverified.</small><Link href="/nearby">All nearby places <ArrowUpRight size={14} /></Link></article>
    <article><h3><Navigation size={18} />Relocation options</h3>{workflow.loading ? <p>Checking assessed relocation sites…</p> : sites.length ? sites.map(({ site, distanceKm, available }) => <a className="local-place" key={site.id} href={directions(location, site)} target="_blank" rel="noreferrer"><span><strong>{site.name}</strong><small>{distanceKm.toFixed(1)} km · {available} places available</small></span><ArrowUpRight size={15} /></a>) : <p>{workflow.error ? "Relocation records could not be loaded." : "No current, verified relocation sites with available capacity are accessible within 50 km."}</p>}<small>Confirm destination and route with authorities before travel. Distances are straight-line estimates.</small><Link href="/relocation">Review relocation sites <ArrowUpRight size={14} /></Link></article>
  </div>;
}
export function LocalSafetyPanel({ showResults = true }: { showResults?: boolean }) {
  const { location, locating, locationMessage, locateOnce } = useLocationSafety();
  const { t } = usePreferences();
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    if (location) setEdit(false);
  }, [location]);
  return <section className="local-safety" aria-label="Safety near your location"><div className="local-safety-heading"><div><span className="safety-eyebrow">YOUR LOCAL SAFETY BRIEF</span><h2><MapPin size={20} />{locating ? "Detecting your location…" : location ? location.name || location.district || location.state || `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}` : "Find guidance for your area"}</h2><p>{location ? "Local warnings, nearby help and relocation options in one place." : locationMessage ? t(locationMessage) : "Allow location access, or choose a place manually."}</p></div><div className="local-safety-actions"><button onClick={locateOnce} disabled={locating}><LocateFixed size={15} />{locating ? "Locating…" : "Use my location"}</button><button onClick={() => setEdit(!edit)} aria-expanded={edit}>{edit ? "Close location search" : "Choose location"}</button></div></div>{edit && <LocationSafetyManager />}{location && showResults && <LocalResults />}</section>;
}
