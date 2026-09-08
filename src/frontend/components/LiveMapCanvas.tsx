"use client";
import { Fragment, useEffect } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Polygon, Popup, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { BoundaryData, DisasterAlert, EarthquakeEvent, LocationIntelligence, LocationPoint, SourceResult } from "@/types/intelligence";
import { usePreferences } from "./AppPreferences";
import { SourceLink } from "./LiveCards";
import { timeLabel } from "@/frontend/lib/live-data";

export type LiveLayers = { alerts: boolean; weather: boolean; earthquakes: boolean; facilities: boolean; boundaries: boolean; news: boolean; groundwater: boolean };
type MapProps = { location: LocationPoint | null; onSelect: (point: LocationPoint) => void; data: LocationIntelligence | null; alerts: DisasterAlert[]; earthquakes: EarthquakeEvent[]; layers: LiveLayers; boundary: SourceResult<BoundaryData> | null };

function MapInteraction({ location, onSelect }: Pick<MapProps, "location" | "onSelect">) {
  const map = useMap();
  useMapEvents({ click(event) { if (event.originalEvent.target instanceof Element && event.originalEvent.target.closest(".leaflet-interactive, .leaflet-popup")) return; const { lat, lng } = event.latlng; if (lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) onSelect({ latitude: lat, longitude: lng }); } });
  useEffect(() => {
    if (location) map.setView([location.latitude, location.longitude], location.district || !location.state ? 10 : 7);
    else map.setView([22.5, 80.5], 4);
  }, [map, location]);
  useEffect(() => {
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(map.getContainer());
    const focus = (event: Event) => {
      const alert = (event as CustomEvent<DisasterAlert>).detail;
      const point = alert.polygons?.[0]?.[0];
      if (alert.latitude !== undefined && alert.longitude !== undefined) map.setView([alert.latitude, alert.longitude], 9);
      else if (point) map.setView([point[1], point[0]], 9);
      else if (alert.circles?.[0]) map.setView([alert.circles[0].latitude, alert.circles[0].longitude], 9);
    };
    const reset = () => map.setView([22.5, 80.5], 4);
    window.addEventListener("suraksha-live-map-focus", focus); window.addEventListener("suraksha-live-map-reset", reset);
    return () => { resize.disconnect(); window.removeEventListener("suraksha-live-map-focus", focus); window.removeEventListener("suraksha-live-map-reset", reset); };
  }, [map]);
  return null;
}

export function LiveMapCanvas({ location, onSelect, data, alerts, earthquakes, layers, boundary }: MapProps) {
  const { t, language } = usePreferences();
  return <MapContainer center={[22.5, 80.5]} zoom={4} minZoom={3} maxZoom={18} className="live-leaflet-map" zoomControl={false} scrollWheelZoom={false}>
    <ZoomControl key={language} zoomInTitle={t("live.zoomIn")} zoomOutTitle={t("live.zoomOut")} />
    <MapInteraction location={location} onSelect={onSelect} />
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {layers.boundaries && boundary?.data?.geojson && <GeoJSON interactive={false} key={`${boundary.fetchedAt}-${boundary.data.level}-${location?.state || "India"}`} data={boundary.data.geojson} style={{ color: "#597986", weight: 1.5, fillOpacity: 0.02, dashArray: "4 4" }} />}
    {location && <CircleMarker center={[location.latitude, location.longitude]} radius={8} pathOptions={{ color: "#fff", fillColor: "#24688e", fillOpacity: 1, weight: 3 }}><Tooltip>{location.name || t("live.selectedPoint")}</Tooltip></CircleMarker>}
    {layers.alerts && alerts.filter((alert) => alert.active).slice(0, 150).map((alert) => {
      const color = ["severe", "extreme"].includes(alert.severity) ? "#c83f49" : "#c38a16";
      const content = <Popup><div className="live-map-popup"><strong>{t("live.official")} · NDMA SACHET</strong><h3>{alert.title}</h3><p>{alert.affectedArea}</p><p>{timeLabel(alert.publishedAt, language)}</p><SourceLink url={alert.sourceUrl} /></div></Popup>;
      return <Fragment key={alert.id}>{alert.polygons?.map((polygon, index) => <Polygon key={index} positions={polygon.map(([lon, lat]) => [lat, lon] as [number, number])} pathOptions={{ color, fillOpacity: .13, weight: 2 }}>{content}</Polygon>)}{alert.circles?.map((circle, index) => <Circle key={`circle-${index}`} center={[circle.latitude, circle.longitude]} radius={circle.radiusKm * 1000} pathOptions={{ color, fillOpacity: .13, weight: 2 }}>{content}</Circle>)}{alert.latitude !== undefined && alert.longitude !== undefined && <CircleMarker center={[alert.latitude, alert.longitude]} radius={8} pathOptions={{ color, fillOpacity: .65 }}>{content}</CircleMarker>}</Fragment>;
    })}
    {layers.earthquakes && earthquakes.slice(0, 100).map((quake) => <CircleMarker key={quake.id} center={[quake.latitude, quake.longitude]} radius={Math.max(5, quake.magnitude * 2)} pathOptions={{ color: "#d26d2e", fillColor: "#df8e41", fillOpacity: .55, weight: 2 }}><Tooltip>M {quake.magnitude.toFixed(1)} · {quake.place}</Tooltip><Popup><div className="live-map-popup"><strong>{t("live.observed")} · USGS</strong><h3>M {quake.magnitude} · {quake.place}</h3><p>{t("live.depth")}: {quake.depthKm} km</p><p>{timeLabel(quake.time, language)}</p>{quake.distanceKm !== undefined && <p>{t("live.distance")}: {quake.distanceKm.toFixed(1)} km</p>}<SourceLink url={quake.sourceUrl} /></div></Popup></CircleMarker>)}
    {layers.facilities && data?.facilities.data.slice(0, 80).map((site) => <CircleMarker key={site.id} center={[site.latitude, site.longitude]} radius={5} pathOptions={{ color: "#256e65", fillColor: "#4e9687", fillOpacity: .8 }}><Tooltip>{site.name}</Tooltip><Popup><div className="live-map-popup"><strong>OpenStreetMap · {t("live.reported")}</strong><h3>{site.name}</h3><p>{t(`live.facility.${site.type}`)} · {site.distanceKm.toFixed(1)} km</p><p>{t("live.capacityUnknown")}</p><p>{t("live.safetyUnknown")}</p><SourceLink url={site.sourceUrl} /></div></Popup></CircleMarker>)}
    {layers.weather && data?.weather.data && <CircleMarker center={[data.weather.data.latitude, data.weather.data.longitude]} radius={16} pathOptions={{ color: "#427bb9", fillOpacity: .1, dashArray: "4 4" }}><Popup><div className="live-map-popup"><strong>Open-Meteo · {t("live.derived")}</strong><p>{t("live.temperature")}: {data.weather.data.temperatureC ?? "—"}°C</p><p>{t("live.rainfall")}: {data.weather.data.rainMm ?? "—"} mm</p></div></Popup></CircleMarker>}
    {layers.groundwater && data?.groundwater.data?.stations.slice(0, 100).map((station, index) => <CircleMarker key={`${station.latitude}-${index}`} center={[station.latitude, station.longitude]} radius={4} pathOptions={{ color: "#705299", fillOpacity: .65 }}><Popup><div className="live-map-popup"><strong>{t("live.layerGroundwater")}</strong><h3>{station.village || station.district}</h3><p>{station.measurementDate} · {station.depthToWaterMetres} m</p><p>{t("live.groundwaterNote")}</p></div></Popup></CircleMarker>)}
  </MapContainer>;
}
