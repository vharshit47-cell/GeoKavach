"use client";
import { usePreferences } from "./AppPreferences";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import type { HazardZoneCollection } from "@/types/disaster";
import { validCoordinates } from "@/shared/config/assessment";
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { RISK_STYLES } from "@/config/risk";
import type { Habitation, RelocationRecommendation, SafeSite } from "@/types/disaster";

const demoBoundary: [number, number][] = [
  [29.93, 79.02], [29.98, 79.74], [30.35, 80.03], [30.82, 80.05],
  [30.93, 79.72], [30.82, 79.25], [30.47, 79.03], [29.93, 79.02],
];

function ViewSync({ plan, selected, site, point }: { point?: {latitude:number;longitude:number}|null; site?: SafeSite | null; plan: RelocationRecommendation | null; selected?: Habitation | null }) {
  const { tr } = usePreferences();
  const map = useMap();
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver.observe(map.getContainer());
    const handleCommand = (event: Event) => {
      const command = (event as CustomEvent<string>).detail;
      if (command === "zoom-in") map.zoomIn();
      if (command === "zoom-out") map.zoomOut();
      if (command === "home") map.setView([30.42, 79.49], 9.1);
    };
    window.addEventListener("suraksha-map-command", handleCommand);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("suraksha-map-command", handleCommand);
    };
  }, [map]);

  useEffect(() => {
    if (!plan) return;
    map.fitBounds(L.latLngBounds(
      [plan.origin_latitude, plan.origin_longitude],
      [plan.site_latitude, plan.site_longitude],
    ), { padding: [70, 70], maxZoom: 12 });
  }, [map, plan]);
  useEffect(() => { if (selected && validCoordinates(selected)) map.setView([selected.latitude, selected.longitude], 12); }, [map, selected]);
  useEffect(() => { if(site && validCoordinates(site)) map.setView([site.latitude,site.longitude],12); }, [map,site]);
  useEffect(() => { if(point && validCoordinates(point)) map.setView([point.latitude,point.longitude],12); }, [map,point]);
  return null;
}

function habitationIcon(habitation: Habitation) {
  const style = RISK_STYLES[habitation.risk_category];
  return L.divIcon({
    className: "",
    html: `<span class="habitation-marker" style="--marker:${style.color}"><i></i></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -11],
  });
}

const safeSiteIcon = L.divIcon({
  className: "",
  html: '<span class="safe-site-marker"><i></i></span>',
  iconSize: [28, 34],
  iconAnchor: [14, 30],
  popupAnchor: [0, -28],
});

export function MapCanvas({
  habitations,
  safeSites,
  showSites,
  showZones = true,
  showBoundary = true,
  focusPoint,
  basemap = "street",
  activeHazards,
  selectedSite,
  onSite,
  hazard = "ALL",
  selectedHabitation,
  selectedPlan,
  onHabitation,
  onRelocation,
}: {
  habitations: Habitation[];
  safeSites: SafeSite[];
  showSites: boolean;
  showZones?: boolean;
  showBoundary?: boolean;
  focusPoint?: { latitude: number; longitude: number } | null;
  basemap?: "street" | "satellite";
  activeHazards?: string[];
  selectedSite?: SafeSite | null;
  onSite?: (site: SafeSite) => void;
  hazard?: string;
  selectedHabitation?: Habitation | null;
  selectedPlan: RelocationRecommendation | null;
  onHabitation: (habitation: Habitation) => void;
  onRelocation: (habitation: Habitation) => void;
}) {
  const { tr } = usePreferences();
  const [zones, setZones] = useState<HazardZoneCollection>({ type: "FeatureCollection", features: [] });
  const [zoneStatus, setZoneStatus] = useState("Loading hazard areas…");
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch("/api/hazard-zones", { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then((data: HazardZoneCollection) => { if (active) { setZones(data); setZoneStatus(""); } }).catch(() => { if (active) setZoneStatus("Hazard layers currently unavailable."); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, []);
  const icons = useMemo(() => new Map(habitations.map((item) => [item.id, habitationIcon(item)])), [habitations]);
  const selectedIds = selectedPlan ? [selectedPlan.habitation_id, selectedPlan.site_id] : [];

  return (
    <MapContainer center={[30.42, 79.49]} zoom={9.1} minZoom={4} maxZoom={18} zoomControl={true} className="leaflet-map">
      {(showZones && zoneStatus || tilesUnavailable) && <div className="map-layer-status" role="status">{showZones && zoneStatus}{tilesUnavailable && " Base map tiles unavailable; assessment layers remain visible."}</div>}
      <ViewSync plan={selectedPlan} selected={selectedHabitation} site={selectedSite} point={focusPoint} />
      <TileLayer key={basemap} attribution={basemap === "satellite" ? "Tiles © Esri — Esri, Maxar, Earthstar Geographics, and the GIS User Community" : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'} url={basemap === "satellite" ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} eventHandlers={{ tileerror: () => setTilesUnavailable(true), load: () => setTilesUnavailable(false) }} />
      {showBoundary && <Polygon positions={demoBoundary} pathOptions={{ color: "#b9c9c2", weight: 2, opacity: 0.8, fillColor: "#4d90a6", fillOpacity: 0.045, dashArray: "6 5" }}><Tooltip>{tr("Demo Dataset — schematic boundary")}</Tooltip></Polygon>}
      {showZones && zones.features.filter(z => (hazard === "ALL" || z.properties.hazard === hazard) && (!activeHazards || activeHazards.includes(z.properties.hazard))).map(z => <Polygon key={z.properties.hazard} positions={z.geometry.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number])} pathOptions={{ color: "#bd3340", weight: 2, fillColor: "#c83f49", fillOpacity: .28 }}><Tooltip>{z.properties.label}</Tooltip></Polygon>)}
      {habitations.filter(validCoordinates).map((habitation) => (
        <Marker
          zIndexOffset={200}
          key={habitation.id}
          position={[habitation.latitude, habitation.longitude]}
          title={`${habitation.name}: risk ${habitation.risk_score}, ${tr(RISK_STYLES[habitation.risk_category].label)}`}
          icon={icons.get(habitation.id)!}
          opacity={selectedPlan && !selectedIds.includes(habitation.id) ? 0.52 : 1}
          eventHandlers={{ click: () => onHabitation(habitation) }}
        >
          <Tooltip direction="top" offset={[0, -10]}><strong>{habitation.name}</strong><br />{tr("Risk")}{" "}{habitation.risk_score} · {tr(RISK_STYLES[habitation.risk_category].label)}</Tooltip>

        </Marker>
      ))}
      {showSites && safeSites.filter(validCoordinates).map((site) => (
        <Marker key={`site-${site.id}`} position={[site.latitude, site.longitude]} title={`${site.name}: ${site.suitability_score}% suitability`} icon={safeSiteIcon} eventHandlers={{ click: () => onSite?.(site) }} opacity={selectedPlan && selectedPlan.site_id !== site.id ? 0.58 : 1}>
          <Tooltip direction="top" offset={[0, -25]}><strong>{site.name}</strong><br />{tr("Suitability")}{" "}{site.suitability_score}% · {site.remaining_capacity.toLocaleString("en-IN")}{" "}{tr("places remaining")}</Tooltip>
          {!onSite && <Popup><div className="site-popup"><span>{tr("SAFE RELOCATION SITE")}</span><h3>{site.name}</h3><p>{tr("Suitability")}<strong>{site.suitability_score}%</strong></p><p>{tr("Remaining capacity")}<strong>{site.remaining_capacity.toLocaleString("en-IN")}</strong></p></div></Popup>}
        </Marker>
      ))}
      {selectedPlan && <Polyline positions={[[selectedPlan.origin_latitude, selectedPlan.origin_longitude], [selectedPlan.site_latitude, selectedPlan.site_longitude]]} pathOptions={{ color: "#56e6a0", weight: 4, opacity: 0.9, dashArray: "8 8" }} />}
    </MapContainer>
  );
}
