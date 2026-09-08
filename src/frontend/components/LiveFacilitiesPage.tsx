"use client";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "./AppShell";
import { usePreferences } from "./AppPreferences";
import { LocationSafetyManager, useLocationSafety } from "./LocationSafetyManager";
import { DataState, SourceLink, SourceStamp } from "./LiveCards";
import { LiveMap } from "./LiveMap";

export function LiveFacilitiesPage({ planning = false }: { planning?: boolean }) {
  const { t } = usePreferences();
  const { location, data, loading } = useLocationSafety();
  const [travelMode,setTravelMode]=useState("driving");
  const [type, setType] = useState("all");
  const facilities = data?.facilities;
  const sites = (facilities?.data || []).filter(site => type === "all" || site.type === type).slice().sort((a, b) => a.distanceKm - b.distanceKm);
  return <AppShell title="Relocation Directions" description="Select the affected location, choose a destination, then compare road routes in Google Maps.">
    <div className="live-dashboard"><LocationSafetyManager />
      <section className="content-card live-panel"><h2>{t("live.verificationNeeded")}</h2><p className="live-caution">{t("live.safetyUnknown")}</p><p>{t("live.planningLimits")}</p></section>
      <section className="content-card live-panel"><h2>Find a route</h2><p>Facilities below are ordered by straight-line distance. Google Maps shows road distance, travel time and alternative routes; select the shortest available route there. Road closures and shelter availability require local confirmation.</p><label>Travel mode <select value={travelMode} onChange={e=>setTravelMode(e.target.value)}><option value="driving">Driving</option><option value="walking">Walking</option></select></label></section><LiveMap />
      <section className="content-card live-panel"><div className="live-panel-heading"><h2>{t("live.facilities")}</h2><label>{t("live.facilityType")} <select value={type} onChange={event => setType(event.target.value)}><option value="all">{t("live.all")}</option>{Array.from(new Set(facilities?.data.map(site => site.type))).sort().map(value => <option key={value} value={value}>{t(`live.facility.${value}`)}</option>)}</select></label></div>
        {!location ? <DataState message="live.chooseLocation" /> : loading ? <DataState loading /> : !facilities || facilities.status === "unavailable" ? <DataState message="live.facilitiesUnavailable" /> : !sites.length ? <DataState message="live.noFacilities" /> : <div className="live-news-grid">{sites.map(site => <article className="live-news-card" key={site.id}><h3>{site.name}</h3><p>{t(`live.facility.${site.type}`)} · {site.distanceKm.toFixed(1)} km</p><small>{t("live.straightDistance")}</small><p>{t("live.capacityUnknown")}</p><p>{t("live.siteRiskUnknown")}</p><SourceLink url={site.sourceUrl} />{location&&<a className="primary-button" target="_blank" rel="noopener noreferrer" href={"https://www.google.com/maps/dir/?"+new URLSearchParams({api:"1",origin:`${location.latitude},${location.longitude}`,destination:`${site.latitude},${site.longitude}`,travelmode:travelMode}).toString()}>Open Google Maps directions ↗</a>}</article>)}</div>}
        <SourceStamp source="OpenStreetMap" time={facilities?.fetchedAt} status={facilities?.status} />
      </section>
    </div>
  </AppShell>;
}
