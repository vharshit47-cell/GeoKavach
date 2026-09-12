"use client";

import { useEffect } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { DisasterAlert, DisasterOccurrence, HazardKind, LocationPoint } from "@/types/intelligence";
import { alertAnchor } from "@/frontend/lib/map/presentation";
import { useMapBoundary } from "./map/useMapData";

const markerCode: Record<HazardKind, string> = {
  flood: "FL",
  earthquake: "EQ",
  landslide: "LS",
  cloudburst: "CB",
  cyclone: "CY",
  fire: "FR",
  "extreme-weather": "WX",
  other: "!",
};

function View({ location, alerts, occurrences, selected }: { location: LocationPoint | null; alerts: DisasterAlert[]; occurrences: DisasterOccurrence[]; selected: string | null }) {
  const map = useMap();
  useEffect(() => {
    const alert = alerts.find(item => item.id === selected);
    const occurrence = occurrences.find(item => item.id === selected);
    const point = occurrence ? { latitude: occurrence.latitude, longitude: occurrence.longitude } : alert ? alertAnchor(alert) : null;
    if (point) map.setView([point.latitude, point.longitude], occurrence?.locationPrecision === "point" ? 7 : 6);
    else if (location) map.setView([location.latitude, location.longitude], location.state && !location.district ? 7 : 9);
    else {
      const points: [number, number][] = [
        ...occurrences.map(item => [item.latitude, item.longitude] as [number, number]),
        ...alerts.flatMap(item => { const anchor = alertAnchor(item); return anchor ? [[anchor.latitude, anchor.longitude] as [number, number]] : []; }),
      ];
      if (points.length) map.fitBounds(latLngBounds(points), { padding: [45, 45], maxZoom: 6 });
      else map.setView([23, 80], 4);
    }
  }, [map, location, alerts, occurrences, selected]);
  useEffect(() => { const resize = new ResizeObserver(() => map.invalidateSize()); resize.observe(map.getContainer()); return () => resize.disconnect(); }, [map]);
  return null;
}

export default function AlertsMap({ location, alerts, occurrences, selected, onSelect }: { location: LocationPoint | null; alerts: DisasterAlert[]; occurrences: DisasterOccurrence[]; selected: string | null; onSelect: (id: string) => void }) {
  const boundary = useMapBoundary(location?.state ? "ADM2" : "ADM1", true, location?.state);
  return <MapContainer center={[23, 80]} zoom={4} minZoom={3} maxZoom={16} scrollWheelZoom={false} className="alerts-leaflet">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <View location={location} alerts={alerts} occurrences={occurrences} selected={selected} />
    {boundary.result?.data && <GeoJSON key={`${location?.state}-${boundary.result.fetchedAt}`} data={boundary.result.data.geojson} interactive={false} style={{ color: "#94a8bd", weight: 1, fillOpacity: .025 }} />}
    {location && <CircleMarker center={[location.latitude, location.longitude]} radius={7} pathOptions={{ color: "white", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}><Tooltip>Your selected location</Tooltip></CircleMarker>}
    {alerts.map(alert => { const point = alertAnchor(alert); if (!point) return null; return <Marker key={alert.id} position={[point.latitude, point.longitude]} title={`Official warning: ${alert.title}`} eventHandlers={{ click: () => onSelect(alert.id) }} icon={divIcon({ className: "alert-map-marker", html: `<span class="disaster-map-pin hazard-${alert.hazardType} warning ${selected === alert.id ? "selected" : ""}"><b>!</b></span>`, iconSize: [34, 38], iconAnchor: [17, 36] })}><Tooltip><strong>Official warning</strong><br />{alert.title}</Tooltip></Marker>; })}
    {occurrences.map(event => <Marker key={event.id} position={[event.latitude, event.longitude]} title={`${event.hazardType}: ${event.title}`} eventHandlers={{ click: () => onSelect(event.id) }} icon={divIcon({ className: "alert-map-marker", html: `<span class="disaster-map-pin hazard-${event.hazardType} ${event.status} ${selected === event.id ? "selected" : ""}"><b>${markerCode[event.hazardType]}</b></span>`, iconSize: [34, 38], iconAnchor: [17, 36] })}><Tooltip><strong>{event.hazardType.replaceAll("-", " ")}</strong><br />{event.title}<br />{event.place}</Tooltip></Marker>)}
  </MapContainer>;
}
