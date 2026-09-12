"use client";

import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { RelocationPlan } from "@/types/relocation";

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
  }, [map, points]);
  return null;
}

const kilometres = (metres?: number) => metres == null ? "Route unavailable" : `${(metres / 1000).toFixed(1)} km`;
const minutes = (seconds?: number) => seconds == null ? "Unavailable" : `${Math.max(1, Math.round(seconds / 60))} min`;

export default function RelocationPlanMap({ plan, selectedSiteId, onSelect }: { plan: RelocationPlan; selectedSiteId?: string; onSelect: (id: string) => void }) {
  const source: [number, number] = [plan.habitation.latitude, plan.habitation.longitude];
  const points = useMemo<[number, number][]>(() => {
    const origin: [number, number] = [plan.habitation.latitude, plan.habitation.longitude];
    const routePoints = plan.assignments.flatMap(assignment => assignment.route?.geometry.coordinates.map(point => [point[1], point[0]] as [number, number]) ?? []);
    return routePoints.length ? [origin, ...routePoints] : [origin, ...plan.candidates.map(site => [site.latitude, site.longitude] as [number, number])];
  }, [plan]);
  return <MapContainer center={source} zoom={11} className="wf-plan-map" scrollWheelZoom>
    <Fit points={points} />
    <TileLayer attribution='© OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {plan.assignments.map((assignment, index) => {
      const positions = assignment.route?.geometry.coordinates.map(point => [point[1], point[0]] as [number, number]);
      return positions?.length ? <Polyline key={assignment.siteId} positions={positions} eventHandlers={{ click: () => onSelect(assignment.siteId) }} pathOptions={{ color: index === 0 ? "#3182f6" : "#7357e8", weight: selectedSiteId === assignment.siteId ? 7 : 4, opacity: selectedSiteId && selectedSiteId !== assignment.siteId ? .45 : .9 }} /> : null;
    })}
    <CircleMarker center={source} radius={11} pathOptions={{ color: "#c43745", fillColor: "#ef5362", fillOpacity: .95, weight: 3 }}>
      <Popup><strong>{plan.habitation.name}</strong><p>Vulnerable habitation · Risk {plan.habitation.riskScore}/100</p><p>{plan.habitation.population.toLocaleString("en-IN")} people</p></Popup>
    </CircleMarker>
    {plan.candidates.map((site, index) => {
      const assignment = plan.assignments.find(item => item.siteId === site.id);
      const selected = selectedSiteId === site.id;
      return <CircleMarker key={site.id} center={[site.latitude, site.longitude]} radius={selected ? 11 : site.eligible ? 8 : 6} eventHandlers={{ click: () => onSelect(site.id) }} pathOptions={{ color: site.eligible ? "#157b53" : "#6d7471", fillColor: site.eligible ? "#36c98b" : "#8b9390", fillOpacity: site.eligible ? .9 : .55, weight: selected ? 4 : 2 }}>
        <Popup><strong>{site.name}</strong>{index === 0 && site.eligible && <p><b>Recommended</b></p>}<p>{site.eligible ? "Eligible field-assessed site" : "Candidate / not eligible"}</p><p>Suitability {site.suitabilityScore == null ? "Not scored" : `${site.suitabilityScore}/100`} · Capacity {site.availableCapacity == null ? "Not verified" : site.availableCapacity.toLocaleString("en-IN")}</p><p>Road distance {kilometres(assignment?.route?.distanceMeters)} · {minutes(assignment?.route?.durationSeconds)}</p></Popup>
      </CircleMarker>;
    })}
  </MapContainer>;
}
