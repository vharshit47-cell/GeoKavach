"use client";
import { Fragment, memo, useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Polygon, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { LeafletEvent, Path } from "leaflet";
import type { BoundaryData, DisasterAlert, EarthquakeEvent, LocationIntelligence, LocationPoint, SourceResult } from "@/types/intelligence";
import { risk, type CaseRecord, type SiteRecord } from "@/shared/workflow/model";
import { alertColor, caseValue, clusterAlerts, clusterCases, inViewport, numberLabel, riskStyle, type MapHazard, type MapLayers, type MapMode, type Selection, type Viewport } from "@/frontend/lib/map/presentation";

type Props = {
  location: LocationPoint | null; focus: (LocationPoint & { zoom?: number }) | null; resetKey: number; onLocation: (point: LocationPoint) => void;
  cases: CaseRecord[]; sites: SiteRecord[]; data: LocationIntelligence | null; alerts: DisasterAlert[]; earthquakes: EarthquakeEvent[];
  states: SourceResult<BoundaryData | null> | null; districts: SourceResult<BoundaryData | null> | null;
  layers: MapLayers; hazard: MapHazard; mode: MapMode; opacity: number; selection: Selection;
  onSelect: (selection: Selection) => void; onViewport: (viewport: Viewport) => void;
  connection: { origin: CaseRecord; destination: SiteRecord } | null;
};

function Interaction({ location, focus, resetKey, onLocation, onViewport }: Pick<Props, "location" | "focus" | "resetKey" | "onLocation" | "onViewport">) {
  const map = useMap();
  const focusLatitude = focus?.latitude;
  const focusLongitude = focus?.longitude;
  const focusZoom = focus?.zoom ?? 12;
  useMapEvents({ click(event) {
    if (event.originalEvent.target instanceof Element && event.originalEvent.target.closest(".leaflet-interactive, .leaflet-control")) return;
    const { lat, lng } = event.latlng;
    if (lat >= 6 && lat <= 38 && lng >= 67 && lng <= 98) onLocation({ latitude: lat, longitude: lng });
  } });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const report = () => { clearTimeout(timer); timer = setTimeout(() => {
      const bounds = map.getBounds();
      onViewport({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest(), zoom: map.getZoom() });
    }, 140); };
    const resize = new ResizeObserver(() => { map.invalidateSize({ pan: false }); report(); });
    resize.observe(map.getContainer()); map.on("moveend", report); report();
    return () => { clearTimeout(timer); resize.disconnect(); map.off("moveend", report); };
  }, [map, onViewport]);
  useEffect(() => {
    if (!location) return;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([location.latitude, location.longitude], location.district ? 9 : location.state ? 6.5 : 10, { animate, duration: .7 });
  }, [map, location]);
  useEffect(() => {
    if (focusLatitude !== undefined && focusLongitude !== undefined) map.flyTo([focusLatitude, focusLongitude], focusZoom, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, duration: .7 });
  }, [map, focusLatitude, focusLongitude, focusZoom]);
  useEffect(() => { if (resetKey) map.flyTo([22.5, 80.5], 4.5, { duration: .7, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches }); }, [map, resetKey]);
  return null;
}

function BoundaryLayer({ result, onLocation, state, selectedName }: { result: SourceResult<BoundaryData | null>; onLocation: Props["onLocation"]; state?: string; selectedName?: string }) {
  const data = result.data;
  if (!data) return null;
  return <GeoJSON key={`${result.fetchedAt}-${data.level}-${state}-${selectedName}`} data={data.geojson} style={feature => ({ color: String(feature?.properties?.shapeName || feature?.properties?.name) === selectedName ? "#347b7b" : "#86999e", weight: 1.2, fillOpacity: .035 })} onEachFeature={(feature, layer) => {
    const id = String(feature.properties?.shapeID || feature.properties?.shapeName || feature.properties?.name);
    const name = data.names.find(item => item.id === id || item.name === id);
    if (!name) return;
    const tooltip = document.createElement("span"); tooltip.textContent = `${name.name} · click to explore`;
    layer.bindTooltip(tooltip, { className: "atlas-tooltip", sticky: true });
    const choose = () => onLocation({ latitude: name.latitude, longitude: name.longitude, name: name.name, state: data.level === "ADM1" ? name.name : state, district: data.level === "ADM2" ? name.name : undefined });
    layer.on("click", choose);
    layer.on("add", () => {
      const element = (layer as Path).getElement?.();
      if (!element) return;
      element.setAttribute("role", "button"); element.setAttribute("tabindex", "0"); element.setAttribute("aria-label", `Explore ${data.level === "ADM1" ? "state" : "district"} ${name.name}`);
      element.addEventListener("keydown", event => { const key = (event as KeyboardEvent).key; if (key === "Enter" || key === " ") { event.preventDefault(); choose(); } });
    });
  }} />;
}

function Hover({ title, children }: { title: string; children: React.ReactNode }) {
  return <Tooltip className="atlas-tooltip" direction="top" sticky><strong>{title}</strong><div>{children}</div></Tooltip>;
}

const EMPTY_CASES: CaseRecord[] = [];
function RiskLayers(props: Props & { view: Viewport | null }) {
  const { cases, sites, layers, hazard, mode, view, opacity, selection, onSelect, data } = props;
  const map = useMap();
  const local = (view?.zoom ?? 4) >= 10;
  const district = (view?.zoom ?? 4) >= 7;
  const shownCases = useMemo(() => cases.filter(record => inViewport(record, view) && (mode !== "impact" || risk(record).score >= 51) && (layers.habitations || layers.redZones && risk(record).redZone)), [cases, view, mode, layers.habitations, layers.redZones]);
  const bubbles = useMemo(() => clusterCases(local ? EMPTY_CASES : shownCases, view?.zoom ?? 4, hazard), [shownCases, local, view?.zoom, hazard]);
  const hover = { mouseover: (event: LeafletEvent) => event.target.setStyle({ weight: 3 }), mouseout: (event: LeafletEvent) => event.target.setStyle({ weight: 1.5 }) };
  const alertOverview = props.alerts.filter(alert => alert.active);
  const alertBubbles = useMemo(() => clusterAlerts(props.alerts), [props.alerts]);
  return <>
    {layers.states && props.states?.data && <BoundaryLayer result={props.states} onLocation={props.onLocation} selectedName={props.location?.state} />}
    {layers.districts && district && props.districts?.data && <BoundaryLayer result={props.districts} onLocation={props.onLocation} state={props.location?.state} selectedName={props.location?.district} />}
    {layers.alerts && !district && alertBubbles.filter(group => inViewport(group, view)).map(group => <CircleMarker key={`alerts-${group.id}`} center={[group.latitude, group.longitude]} radius={17 + Math.sqrt(group.records.length) * 10} pathOptions={{ color: alertColor(group.severity), fillOpacity: opacity, weight: 1 }} eventHandlers={{ click: () => { map.flyTo([group.latitude, group.longitude], 8, { duration: .7 }); onSelect({ kind: "alert", record: group.records[0] }); } }}><Hover title={group.records[0].affectedArea || "Official warnings"}><p>{group.records.length} current warnings · {group.severity}</p><p>NDMA SACHET · bubble size: warning count</p><p>Click to inspect official extents</p></Hover></CircleMarker>)}
    {layers.alerts && district && alertOverview.slice(0, 250).map(alert => {
      const color = alertColor(alert.severity);
      const selected = selection?.kind === "alert" && selection.record.id === alert.id;
      const events = { ...hover, click: () => onSelect({ kind: "alert", record: alert }) };
      const style = { color, fillColor: color, fillOpacity: opacity, weight: selected ? 3 : 1.5 };
      const content = <Hover title={alert.title}><p>Official · {alert.severity} · {alert.hazardType}</p><p>{alert.affectedArea}</p><p>Population exposure: unassessed</p></Hover>;
      // At regional/local zoom, show the provider's actual polygon/circle geometry.
      return <Fragment key={alert.id}>{alert.polygons?.map((ring, index) => <Polygon key={`p${index}`} positions={ring.map(([lon, lat]) => [lat, lon] as [number, number])} pathOptions={style} eventHandlers={events}>{content}</Polygon>)}{alert.circles?.map((circle, index) => <Circle key={`c${index}`} center={[circle.latitude, circle.longitude]} radius={circle.radiusKm * 1000} pathOptions={style} eventHandlers={events}>{content}</Circle>)}{alert.latitude !== undefined && alert.longitude !== undefined && inViewport({ latitude: alert.latitude, longitude: alert.longitude }, view) && !alert.polygons?.length && !alert.circles?.length && <CircleMarker center={[alert.latitude, alert.longitude]} radius={district ? 8 : 15} pathOptions={style} eventHandlers={events}>{content}</CircleMarker>}</Fragment>;
    })}
    {layers.earthquakes && (hazard === "all" || hazard === "multi" || hazard === "earthquake") && props.earthquakes.filter(quake => inViewport(quake, view)).slice(0, 250).map(quake => <CircleMarker key={quake.id} center={[quake.latitude, quake.longitude]} radius={district ? Math.max(5, quake.magnitude * 2) : Math.max(7, quake.magnitude * 4)} pathOptions={{ color: "#b97653", fillColor: "#d59a75", fillOpacity: opacity, weight: selection?.kind === "earthquake" && selection.record.id === quake.id ? 3 : 1 }} eventHandlers={{ click: () => onSelect({ kind: "earthquake", record: quake }) }}><Hover title={quake.place}><p>USGS · M {quake.magnitude.toFixed(1)}</p><p>Depth: {quake.depthKm} km</p><p>Impact: unassessed</p></Hover></CircleMarker>)}
    {bubbles.map(group => <CircleMarker key={group.id} center={[group.latitude, group.longitude]} radius={Math.min(56, 13 + Math.sqrt(group.population) / 15)} pathOptions={{ color: riskStyle(group.score).color, fillOpacity: opacity, weight: 1.5 }} eventHandlers={{ ...hover, click: () => {
      if (group.records.length === 1) onSelect({ kind: "habitation", id: group.records[0].id });
      else map.flyTo([group.latitude, group.longitude], Math.min(12, (view?.zoom ?? 4) + 2), { duration: .7 });
    } }}><Hover title={group.records.length === 1 ? group.records[0].name : `${group.records.length} nearby assessed habitations`}><p>Highest {hazard === "all" || hazard === "multi" ? `risk: ${numberLabel(group.score)} / 100` : `intensity: ${group.score === null ? "—" : group.score / 20} / 5`}</p><p>Population: {numberLabel(group.population)}</p><p>{riskStyle(group.score).label} · click to explore</p></Hover></CircleMarker>)}
    {local && shownCases.slice(0, 500).map(record => { const value = caseValue(record, hazard); const report = risk(record); const selected = selection?.kind === "habitation" && selection.id === record.id; return <CircleMarker key={record.id} center={[record.latitude, record.longitude]} radius={selected ? 10 : 7} pathOptions={{ color: selected ? "#263e46" : riskStyle(value).color, fillColor: riskStyle(value).color, fillOpacity: .85, weight: selected ? 3 : 2, dashArray: layers.redZones && report.redZone ? "3 2" : undefined }} eventHandlers={{ click: () => onSelect({ kind: "habitation", id: record.id }) }}><Hover title={record.name}><p>Risk: {report.score}/100 · {report.category}</p><p>Population: {numberLabel(record.population)}</p><p>{report.redZone ? "Red-zone review candidate" : report.confidence}</p></Hover></CircleMarker>; })}
    {layers.sites && district && sites.filter(site => inViewport(site, view)).slice(0, 300).map(site => <CircleMarker key={site.id} center={[site.latitude, site.longitude]} radius={selection?.kind === "site" && selection.id === site.id ? 10 : 6} pathOptions={{ color: "#fff", fillColor: site.verified ? "#277f76" : "#77858a", fillOpacity: 1, weight: 2.5 }} eventHandlers={{ click: () => onSelect({ kind: "site", id: site.id }) }}><Hover title={site.name}><p>{site.verified ? "Field-verified relocation site" : "Verification required"}</p><p>Click for capacity and evidence</p></Hover></CircleMarker>)}
    {layers.facilities && local && data?.facilities.data.filter(site => inViewport(site, view)).slice(0, 150).map(site => <CircleMarker key={site.id} center={[site.latitude, site.longitude]} radius={4} pathOptions={{ color: "#457d84", fillOpacity: .1, weight: 2 }} eventHandlers={{ click: () => onSelect({ kind: "facility", record: site }) }}><Hover title={site.name}><p>OpenStreetMap · {site.type}</p><p>Safety & capacity: unassessed</p></Hover></CircleMarker>)}
    {layers.weather && data?.weather.data && <CircleMarker center={[data.weather.data.latitude, data.weather.data.longitude]} radius={18} pathOptions={{ color: "#4b8098", fillOpacity: .15, dashArray: "4 3" }}><Hover title="Open-Meteo · model forecast"><p>Temperature: {data.weather.data.temperatureC ?? "—"}°C</p><p>Rainfall: {data.weather.data.rainMm ?? "—"} mm</p></Hover></CircleMarker>}
    {props.connection && local && <Polyline positions={[[props.connection.origin.latitude, props.connection.origin.longitude], [props.connection.destination.latitude, props.connection.destination.longitude]]} pathOptions={{ color: "#277f76", weight: 2.5, dashArray: "6 5" }}><Hover title="Recorded relocation connection"><p>Straight-line connection, not a road route</p></Hover></Polyline>}
    {props.location && <CircleMarker center={[props.location.latitude, props.location.longitude]} radius={4} pathOptions={{ color: "#fff", fillColor: "#263e46", fillOpacity: 1, weight: 2 }} />}
    {local && shownCases.length > 500 && <div className="atlas-render-note">Showing 500 of {shownCases.length} habitations. Zoom in to inspect the remainder.</div>}
  </>;
}

function Canvas(props: Props) {
  const [view, setView] = useState<Viewport | null>(null);
  const [tileError, setTileError] = useState(false);
  const onViewport = useMemo(() => (next: Viewport) => { setView(next); props.onViewport(next); }, [props.onViewport]);
  return <MapContainer center={[22.5, 80.5]} zoom={4.5} zoomSnap={.5} minZoom={3} maxZoom={18} className="atlas-leaflet" zoomControl={false} scrollWheelZoom={true}>
    <ZoomControl position="bottomleft" />
    <Interaction location={props.location} focus={props.focus} resetKey={props.resetKey} onLocation={props.onLocation} onViewport={onViewport} />
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }} />
    <RiskLayers {...props} view={view} />
    {tileError && <div className="atlas-render-note" role="status">Basemap temporarily unavailable. Assessment layers remain usable.</div>}
  </MapContainer>;
}
export default memo(Canvas);
