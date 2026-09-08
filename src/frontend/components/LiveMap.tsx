"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Focus, Layers3 } from "lucide-react";
import type { BoundaryData, LocationPoint, SourceResult } from "@/types/intelligence";
import type { LiveLayers } from "./LiveMapCanvas";
import { useLocationSafety } from "./LocationSafetyManager";
import { usePreferences } from "./AppPreferences";
import { fetchLive } from "@/frontend/lib/live-data";
import { DataState } from "./LiveCards";
import { GoogleLocationMap } from "./GoogleLocationMap";

const DynamicMap = dynamic(() => import("./LiveMapCanvas").then((module) => module.LiveMapCanvas), { ssr: false, loading: () => <DataState loading /> });
export function LiveMap() {
  const { t } = usePreferences();
  const { location, selectMapLocation, data, nationalAlerts, nationalEarthquakes } = useLocationSafety();
  const [layers, setLayers] = useState<LiveLayers>({ alerts: true, weather: false, earthquakes: true, facilities: true, boundaries: false, news: false, groundwater: false });
  const [boundary, setBoundary] = useState<SourceResult<BoundaryData> | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState(false);
  useEffect(() => {
    if (!layers.boundaries) return;
    const controller = new AbortController();
    const query = location?.state ? `level=ADM2&state=${encodeURIComponent(location.state)}&lat=${location.latitude}&lon=${location.longitude}` : "level=ADM1";
    setBoundaryLoading(true); setBoundaryError(false);
    fetchLive<SourceResult<BoundaryData>>(`/api/boundaries?${query}`, controller.signal).then((result) => { if (!controller.signal.aborted) { setBoundary(result); setBoundaryError(result.status === "unavailable"); } }).catch(() => { if (!controller.signal.aborted) setBoundaryError(true); }).finally(() => { if (!controller.signal.aborted) setBoundaryLoading(false); });
    return () => controller.abort();
  }, [layers.boundaries, location]);
  const onSelect = (point: LocationPoint) => selectMapLocation(point);
  return <section className="map-card live-map-card" id="india-map"><div className="live-map-heading"><div><span className="section-kicker">GIS · INDIA</span><h2>{t("live.map")}</h2><p>{t("live.mapHint")}</p></div><button className="secondary-button" onClick={() => window.dispatchEvent(new Event("suraksha-live-map-reset"))}><Focus size={14} />{t("live.resetMap")}</button></div>
    <div className="live-layer-controls" aria-label={t("live.layers")}><Layers3 size={15} />{([["alerts", "layerAlerts"], ["weather", "layerWeather"], ["earthquakes", "layerEarthquakes"], ["facilities", "layerFacilities"], ["boundaries", "layerBoundaries"]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={layers[key]} onChange={(event) => setLayers((previous) => ({ ...previous, [key]: event.target.checked }))} />{t(`live.${label}`)}</label>)}</div>
    <div className="live-map-stage"><DynamicMap location={location} onSelect={onSelect} data={data} alerts={(location ? data?.alerts.data : nationalAlerts?.data) || []} earthquakes={(location ? data?.earthquakes.data : nationalEarthquakes?.data) || []} layers={layers} boundary={boundary} /></div>
    <div className="live-map-notes"><span><i className="official-dot" />{t("live.official")}</span><span><i className="quake-dot" />USGS</span><span><i className="facility-dot" />{t("live.layerFacilities")}</span>{layers.news && <p>{t("live.newsNoDistance")}</p>}{layers.boundaries && <p>{boundaryLoading ? t("live.boundaryLoading") : boundaryError ? t("live.boundaryError") : `${t("live.historicalBoundary")} · ${boundary?.data?.license || "geoBoundaries"}`}</p>}{layers.groundwater && !data?.groundwater.data?.stations.length && <p>{t("live.layerNoGeometry")}</p>}</div>
    <GoogleLocationMap location={location} />
  </section>;
}
