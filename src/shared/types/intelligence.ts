import type { FeatureCollection, Geometry } from "geojson";

export type EvidenceKind = "official" | "observed" | "reported" | "model-derived" | "historical" | "demo";
export type Severity = "unknown" | "low" | "moderate" | "high" | "severe" | "extreme";
export type HazardKind = "flood" | "landslide" | "earthquake" | "cloudburst" | "cyclone" | "fire" | "extreme-weather" | "other";
export interface SourceResult<T> {
  data: T;
  status: "live" | "cached" | "stale" | "unavailable" | "historical";
  source: string;
  attribution: string;
  fetchedAt: string | null;
  error?: string;
  note?: string;
}
export interface LocationPoint { latitude: number; longitude: number; name?: string; state?: string; district?: string }
export interface DisasterAlert {
  id: string; source: "NDMA SACHET"; kind: "official"; isOfficial: true;
  hazardType: HazardKind; title: string; description: string; severity: Severity;
  urgency?: string; certainty?: string; issuingAuthority?: string; action?: string;
  latitude?: number; longitude?: number; polygons?: number[][][]; circles?: Array<{ latitude: number; longitude: number; radiusKm: number }>;
  state?: string; district?: string; affectedArea?: string;
  startTime?: string; endTime?: string; publishedAt: string; sourceUrl?: string;
  distanceKm?: number; locationMatch: "polygon" | "district" | "state" | "nearby" | "unknown";
  active: boolean; priority: "P0" | "P1" | "P2" | "P3" | "P4";
}
export interface WeatherData {
  latitude: number; longitude: number; kind: "model-derived"; time: string;
  temperatureC: number | null; humidityPct: number | null; precipitationMm: number | null;
  rainMm: number | null; windKph: number | null; gustKph: number | null; weatherCode: number | null;
  forecast: Array<{ date: string; precipitationMm: number | null; precipitationProbabilityPct: number | null; gustKph: number | null; temperatureMaxC: number | null; temperatureMinC: number | null }>;
}
export interface EarthquakeEvent {
  id: string; source: "USGS"; kind: "observed"; magnitude: number; latitude: number; longitude: number;
  depthKm: number; time: string; place: string; sourceUrl: string; distanceKm?: number;
}
export interface DisasterOccurrence {
  id: string;
  hazardType: HazardKind;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  place: string;
  occurredAt: string;
  endedAt?: string;
  source: "USGS" | "NASA EONET / GDACS" | "Government of India / PIB";
  sourceUrl: string;
  kind: "observed" | "reported" | "historical";
  status: "recent" | "ongoing" | "ended" | "reference";
  severity: Severity;
  locationPrecision: "point" | "area-centroid";
  magnitude?: number;
  magnitudeUnit?: string;
}
export interface DisasterOccurrenceFeed {
  data: DisasterOccurrence[];
  status: "live" | "cached" | "stale" | "unavailable";
  fetchedAt: string;
  coverage: string;
  sources: Array<{ name: string; status: SourceResult<unknown>["status"]; note: string }>;
}
export interface NewsArticle {
  id: string; kind: "reported"; title: string; source: string; sourceUrl: string;
  publishedAt: string | null; imageUrl?: string; hazardType: HazardKind;
  locationLabel: string; distanceKm: null; locationPrecision: "text-match";
  reliability: "major-news-source" | "other-report"; clusterKey: string;
}
export interface NearbyFacility {
  id: string; name: string; latitude: number; longitude: number; type: string;
  distanceKm: number; capacity: null; capacityStatus: "unknown"; riskLevel: "unassessed";
  reason: string; source: "OpenStreetMap"; kind: "reported"; sourceUrl: string;
  phone?: string; wheelchair?: string; access?: string; verifiedShelter: false;
}
export interface GroundwaterStation {
  latitude: number; longitude: number; state: string; district: string; village: string;
  measurementDate: string; depthToWaterMetres: number; distanceKm?: number;
  qualityFlags: string; sourceFile: string;
}
export interface GroundwaterData {
  kind: "historical"; stations: GroundwaterStation[]; totalStations: number; totalRecords: number;
  earliestDate: string | null; latestDate: string | null; note: string;
}
export interface LiveRisk {
  kind: "model-derived"; score: number | null; status: "UNKNOWN" | "WATCH" | "WARNING" | "SEVERE_ALERT" | "NO_SIGNIFICANT_SIGNAL";
  factors: Array<{ code: string; label: string; points: number; source: string; kind: EvidenceKind; detail: string }>;
  confidence: "limited" | "partial" | "supported"; unavailableSources: string[];
  explanation: string; limitations: string[]; recommendedActions: string[];
}
export interface LocationIntelligence {
  location: LocationPoint; updatedAt: string; radiusKm: number;
  alerts: SourceResult<DisasterAlert[]>; weather: SourceResult<WeatherData | null>;
  earthquakes: SourceResult<EarthquakeEvent[]>; news: SourceResult<NewsArticle[]>;
  facilities: SourceResult<NearbyFacility[]>; groundwater: SourceResult<GroundwaterData | null>;
  risk: LiveRisk;
}
export interface BoundaryData {
  geojson: FeatureCollection<Geometry>; level: "ADM0" | "ADM1" | "ADM2";
  names: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  license: string; boundaryYear?: string;
}
