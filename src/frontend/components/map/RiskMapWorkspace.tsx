"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { LocationPoint } from "@/types/intelligence";
import { reservedStatuses, type CaseRecord, type SiteRecord } from "@/shared/workflow/model";
import { alertAnchor, alertMatches, inViewport, type MapHazard, type MapLayers, type Selection, type Viewport } from "@/frontend/lib/map/presentation";
import { AppShell } from "../AppShell";
import { useLocationSafety } from "../LocationSafetyManager";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { useMapBoundary, useMapWorkflow } from "./useMapData";
import "@/frontend/styles/risk-map.css";

const Canvas = dynamic(() => import("./RiskMapCanvas"), {
  ssr: false,
  loading: () => <div className="atlas-map-loading"><LoaderCircle size={22} className="spin" /><span>Preparing the live map…</span></div>,
});

const EMPTY_CASES: CaseRecord[] = [];
const EMPTY_SITES: SiteRecord[] = [];
const LIVE_LAYERS: MapLayers = {
  habitations: true,
  sites: true,
  redZones: true,
  alerts: true,
  earthquakes: true,
  facilities: true,
  weather: false,
  states: true,
  districts: true,
};

export function RiskMapWorkspace() {
  const { location, data, nationalAlerts, nationalEarthquakes, selectLocation, selectMapLocation } = useLocationSafety();
  const workflow = useMapWorkflow();
  const [hazard] = useState<MapHazard>("all");
  const [selection, setSelection] = useState<Selection>(null);
  const [view, setView] = useState<Viewport | null>(null);
  const states = useMapBoundary("ADM1", true);
  const districts = useMapBoundary("ADM2", Boolean(location?.state) && (view?.zoom ?? 4) >= 6, location?.state);
  const allCases = workflow.snapshot?.cases ?? EMPTY_CASES;
  const allSites = workflow.snapshot?.sites ?? EMPTY_SITES;
  const casesInView = useMemo(() => allCases.filter(record => inViewport(record, view)), [allCases, view]);
  const alertsSource = location ? data?.alerts : nationalAlerts;
  const earthquakesSource = location ? data?.earthquakes : nationalEarthquakes;
  const alerts = useMemo(() => (alertsSource?.data ?? []).filter(alert => alert.active && alertMatches(alert, hazard)), [alertsSource, hazard]);
  const earthquakes = useMemo(() => earthquakesSource?.data ?? [], [earthquakesSource]);
  const focus = useMemo(() => {
    if (selection?.kind === "habitation") return allCases.find(record => record.id === selection.id) ?? null;
    if (selection?.kind === "site") return allSites.find(record => record.id === selection.id) ?? null;
    if (selection?.kind === "alert") {
      const point = alertAnchor(selection.record);
      return point ? { ...point, zoom: 9 } : null;
    }
    if (selection?.kind === "earthquake" || selection?.kind === "facility") {
      return { latitude: selection.record.latitude, longitude: selection.record.longitude, zoom: selection.kind === "facility" ? 13 : 9 };
    }
    return null;
  }, [selection, allCases, allSites]);
  const select = useCallback((next: Selection) => setSelection(next), []);
  const chooseLocation = useCallback((point: LocationPoint) => {
    setSelection(null);
    if (point.state || point.name) selectLocation(point);
    else selectMapLocation(point);
  }, [selectLocation, selectMapLocation]);
  const connection = useMemo(() => {
    const plan = workflow.snapshot?.plans.find(record => reservedStatuses.includes(record.status) && (
      selection?.kind === "habitation" ? record.caseId === selection.id : selection?.kind === "site" && record.siteId === selection.id
    ));
    const origin = plan && allCases.find(record => record.id === plan.caseId);
    const destination = plan && allSites.find(record => record.id === plan.siteId);
    return origin && destination ? { origin, destination } : null;
  }, [workflow.snapshot, selection, allCases, allSites]);

  return <AppShell title="Live Hazard Map" description="Official alerts, recorded events and existing relocation evidence.">
    <section className="risk-atlas risk-atlas-clean" aria-label="GeoKavach live hazard map">
      <div className="atlas-canvas">
        <MapErrorBoundary>
          <Canvas location={location} focus={focus} resetKey={0} onLocation={chooseLocation} cases={casesInView} sites={allSites} data={data} alerts={alerts} earthquakes={earthquakes} states={states.result} districts={districts.result} layers={LIVE_LAYERS} hazard={hazard} mode="hazard" opacity={0.35} selection={selection} onSelect={select} onViewport={setView} connection={connection} />
        </MapErrorBoundary>
      </div>
    </section>
  </AppShell>;
}
