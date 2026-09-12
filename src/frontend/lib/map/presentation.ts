import type { DisasterAlert, EarthquakeEvent, NearbyFacility } from "@/types/intelligence";
import { risk, type CaseRecord, type SiteRecord } from "@/shared/workflow/model";
import { INDIA_REGIONS } from "@/config/india";

export const HAZARD_OPTIONS = [
  ["all", "All Hazards"], ["multi", "Multi Hazard"], ["flood", "Flood"],
  ["landslide", "Landslide"], ["earthquake", "Earthquake"], ["cyclone", "Cyclone"],
  ["coastalErosion", "Coastal Erosion"], ["cloudburst", "Cloudburst"],
] as const;
export type MapHazard = typeof HAZARD_OPTIONS[number][0];
export type MapMode = "exposure" | "hazard" | "impact";
export type MapLayers = { habitations: boolean; sites: boolean; redZones: boolean; alerts: boolean; earthquakes: boolean; facilities: boolean; weather: boolean; states: boolean; districts: boolean };
export type Viewport = { north: number; south: number; east: number; west: number; zoom: number };
export type Selection = { kind: "habitation"; id: string } | { kind: "site"; id: string } |
  { kind: "alert"; record: DisasterAlert } | { kind: "earthquake"; record: EarthquakeEvent } |
  { kind: "facility"; record: NearbyFacility } | null;
export const RISK_SCALE = [
  { label: "Very Low", max: 20, color: "#4b8098" },
  { label: "Low", max: 40, color: "#83a6b0" },
  { label: "Moderate", max: 60, color: "#ba9957" },
  { label: "High", max: 80, color: "#cc7155" },
  { label: "Critical", max: 100, color: "#9b3747" },
] as const;
// Display bands only. Workflow category, redZone and eligibility are never changed here.
export function riskStyle(score: number | null) {
  return score === null || !Number.isFinite(score) ? { label: "Unassessed", color: "#7a8589" } : RISK_SCALE.find(band => score <= band.max) ?? RISK_SCALE[4];
}
export const hazardLabel = (hazard: MapHazard) => HAZARD_OPTIONS.find(([key]) => key === hazard)![1];
export function caseValue(record: CaseRecord, hazard: MapHazard): number | null {
  if (hazard === "all" || hazard === "multi") return risk(record).score;
  // Native field intensity is 0–5; percentage is used only for color/bar length.
  return hazard in record.hazards ? record.hazards[hazard as keyof CaseRecord["hazards"]] * 20 : null;
}
export function alertMatches(alert: DisasterAlert, hazard: MapHazard) {
  if (hazard === "all" || hazard === "multi") return true;
  if (hazard === "cloudburst") return /cloud\s*burst/i.test(`${alert.title} ${alert.description}`);
  if (hazard === "coastalErosion") return /coastal\s+erosion/i.test(`${alert.title} ${alert.description}`);
  return alert.hazardType === hazard;
}
export function alertColor(severity: DisasterAlert["severity"]) {
  return ({ unknown: "#7a8589", low: "#83a6b0", moderate: "#ba9957", high: "#cc7155", severe: "#ae4c48", extreme: "#9b3747" })[severity];
}
export function alertAnchor(alert: DisasterAlert): { latitude: number; longitude: number } | null {
  if (Number.isFinite(alert.latitude) && Number.isFinite(alert.longitude)) return { latitude: alert.latitude!, longitude: alert.longitude! };
  if (alert.circles?.[0]) return alert.circles[0];
  const ring = alert.polygons?.[0];
  if (!ring?.length) return null;
  return { latitude: ring.reduce((sum, point) => sum + point[1], 0) / ring.length, longitude: ring.reduce((sum, point) => sum + point[0], 0) / ring.length };
}
/** Navigation references only: never use these centres for hazard extents or point-risk matching. */
export function alertRegions(alert: DisasterAlert) {
  if (alertAnchor(alert)) return [];
  const area = `${alert.state || ""} ${alert.affectedArea || ""}`.toLocaleLowerCase();
  return INDIA_REGIONS.filter(region => [region.name, region.hindi].some(name => {
    const escaped = name.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, "u").test(area);
  }));
}

export function regionalAlertGroups(alerts: DisasterAlert[]) {
  const groups = new Map<string, { region: typeof INDIA_REGIONS[number]; records: DisasterAlert[] }>();
  for (const alert of alerts) {
    if (!alert.active) continue;
    for (const region of alertRegions(alert)) {
      const group = groups.get(region.name) ?? { region, records: [] };
      group.records.push(alert);
      groups.set(region.name, group);
    }
  }
  return [...groups.values()];
}

/** Keep nationwide coverage while adding details discovered for the selected point. */
export function mapAlerts(national: DisasterAlert[], local: DisasterAlert[], hazard: MapHazard) {
  const key = (alert: DisasterAlert) => alert.sourceUrl || alert.id;
  const alerts = new Map(national.map(alert => [key(alert), alert]));
  for (const alert of local) {
    const existing = alerts.get(key(alert));
    if (!existing || !existing.endTime && alert.endTime || !alertAnchor(existing) && alertAnchor(alert)) alerts.set(key(alert), alert);
  }
  return [...alerts.values()].filter(alert => alert.active && alertMatches(alert, hazard));
}
export function clusterAlerts(alerts: DisasterAlert[]) {
  const order = ["unknown", "low", "moderate", "high", "severe", "extreme"];
  const groups = new Map<string, { id: string; latitude: number; longitude: number; severity: DisasterAlert["severity"]; records: DisasterAlert[] }>();
  for (const alert of alerts) {
    const point = alertAnchor(alert);
    if (!point) continue;
    const id = `${Math.floor(point.latitude / 1.5)}:${Math.floor(point.longitude / 1.5)}`;
    const group = groups.get(id) ?? { id, latitude: 0, longitude: 0, severity: alert.severity, records: [] };
    group.latitude += point.latitude; group.longitude += point.longitude; group.records.push(alert);
    if (order.indexOf(alert.severity) > order.indexOf(group.severity)) group.severity = alert.severity;
    groups.set(id, group);
  }
  return [...groups.values()].map(group => ({ ...group, latitude: group.latitude / group.records.length, longitude: group.longitude / group.records.length }));
}
export function inViewport(point: { latitude: number; longitude: number }, view: Viewport | null) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && (!view ||
    point.latitude >= view.south && point.latitude <= view.north && point.longitude >= view.west && point.longitude <= view.east);
}
export const numberLabel = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-IN");
export function clusterCases(records: CaseRecord[], zoom: number, hazard: MapHazard) {
  const cell = zoom < 6 ? 2.5 : zoom < 8 ? .65 : .15;
  const groups = new Map<string, { id: string; latitude: number; longitude: number; population: number; records: CaseRecord[]; score: number | null }>();
  for (const record of records) {
    const id = `${Math.floor(record.latitude / cell)}:${Math.floor(record.longitude / cell)}`;
    const group = groups.get(id) ?? { id, latitude: 0, longitude: 0, population: 0, records: [], score: null };
    group.latitude += record.latitude; group.longitude += record.longitude;
    group.population += record.population; group.records.push(record);
    const score = caseValue(record, hazard);
    if (score !== null) group.score = Math.max(group.score ?? 0, score);
    groups.set(id, group);
  }
  return [...groups.values()].map(group => ({ ...group, latitude: group.latitude / group.records.length, longitude: group.longitude / group.records.length }));
}
export function relocationLink(record?: CaseRecord, site?: SiteRecord) {
  const params = new URLSearchParams();
  if (record) params.set("habitation", record.id);
  if (site) params.set("site", site.id);
  return `/relocation${params.size ? `?${params}` : ""}`;
}
