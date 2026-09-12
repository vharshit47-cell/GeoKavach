import type { DisasterOccurrence, DisasterOccurrenceFeed, EarthquakeEvent, HazardKind, Severity, SourceResult } from "@/types/intelligence";
import { cachedProvider, cleanText, fetchJson, finite, hazardFromText, isoDate, record, safeUrl } from "./core";
import { getEarthquakes } from "./earthquake";

const INDIA_REGION = { minLat: 6, maxLat: 38, minLon: 67, maxLon: 98 } as const;

const VERIFIED_REFERENCE_EVENTS: DisasterOccurrence[] = [
  {
    id: "pib-dharali-cloudburst-2025",
    hazardType: "cloudburst",
    title: "Dharali cloudburst and flash flood",
    description: "A Government of India release records a devastating cloudburst near Dharali village on 5 August 2025 and the resulting sudden rise of the Kheer Ganga river.",
    latitude: 30.73,
    longitude: 78.60,
    place: "Dharali, Uttarkashi, Uttarakhand",
    occurredAt: "2025-08-05T00:00:00.000Z",
    source: "Government of India / PIB",
    sourceUrl: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2156502&lang=2&reg=48",
    kind: "historical",
    status: "reference",
    severity: "severe",
    locationPrecision: "area-centroid",
  },
  {
    id: "pib-wayanad-landslide-2024",
    hazardType: "landslide",
    title: "Wayanad landslides",
    description: "A Government of India release records the major landslide that hit Chooralmala and Mundakkai in Wayanad district on 30 July 2024.",
    latitude: 11.51,
    longitude: 76.13,
    place: "Chooralmala–Mundakkai, Wayanad, Kerala",
    occurredAt: "2024-07-30T00:00:00.000Z",
    source: "Government of India / PIB",
    sourceUrl: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2039899&lang=2&reg=3",
    kind: "historical",
    status: "reference",
    severity: "extreme",
    locationPrecision: "area-centroid",
  },
  {
    id: "pib-sikkim-glof-2023",
    hazardType: "flood",
    title: "South Lhonak glacial lake outburst flood",
    description: "A Government of India release records the South Lhonak glacial lake outburst and devastating downstream flooding in Sikkim on 3–4 October 2023.",
    latitude: 27.91,
    longitude: 88.20,
    place: "South Lhonak–Teesta basin, North Sikkim",
    occurredAt: "2023-10-03T18:30:00.000Z",
    source: "Government of India / PIB",
    sourceUrl: "https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1965603&lang=2&reg=3",
    kind: "historical",
    status: "reference",
    severity: "extreme",
    locationPrecision: "area-centroid",
  },
];

function coordinatePair(value: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const first = finite(value[0]);
  const second = finite(value[1]);
  if (first === null || second === null) return null;
  if (first >= INDIA_REGION.minLon && first <= INDIA_REGION.maxLon && second >= INDIA_REGION.minLat && second <= INDIA_REGION.maxLat) {
    return { longitude: first, latitude: second };
  }
  // Some upstream GDACS polygons have historically arrived in latitude/longitude order.
  if (second >= INDIA_REGION.minLon && second <= INDIA_REGION.maxLon && first >= INDIA_REGION.minLat && first <= INDIA_REGION.maxLat) {
    return { longitude: second, latitude: first };
  }
  return null;
}

function geometryAnchor(value: unknown): { latitude: number; longitude: number; precision: DisasterOccurrence["locationPrecision"] } | null {
  const geometry = record(value);
  const direct = coordinatePair(geometry.coordinates);
  if (direct) return { ...direct, precision: "point" };
  const points: Array<{ latitude: number; longitude: number }> = [];
  const visit = (node: unknown) => {
    if (points.length >= 5000 || !Array.isArray(node)) return;
    const point = coordinatePair(node);
    if (point) { points.push(point); return; }
    node.forEach(visit);
  };
  visit(geometry.coordinates);
  if (!points.length) return null;
  const latitudes = points.map(point => point.latitude);
  const longitudes = points.map(point => point.longitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    precision: "area-centroid",
  };
}

function eonetHazard(categories: unknown, title: string): HazardKind {
  const ids = Array.isArray(categories) ? categories.map(item => String(record(item).id || "")) : [];
  if (ids.includes("landslides")) return "landslide";
  if (ids.includes("floods")) return "flood";
  if (ids.includes("severeStorms")) {
    const fromTitle = hazardFromText(title);
    return fromTitle === "cyclone" || fromTitle === "cloudburst" ? fromTitle : "extreme-weather";
  }
  return hazardFromText(title);
}

function eonetSeverity(hazardType: HazardKind, magnitude: number | null, open: boolean): Severity {
  if (hazardType === "cyclone" && magnitude !== null) return magnitude >= 64 ? "severe" : magnitude >= 34 ? "high" : "moderate";
  if (open) return "high";
  return hazardType === "flood" || hazardType === "landslide" ? "moderate" : "unknown";
}

export function parseEonetEvents(raw: unknown): DisasterOccurrence[] {
  const events = record(raw).events;
  if (!Array.isArray(events)) return [];
  return events.flatMap(value => {
    const event = record(value);
    const title = cleanText(event.title, 300);
    const geometries = Array.isArray(event.geometry) ? event.geometry.map(record) : [];
    const dated = geometries
      .map(geometry => ({ geometry, date: isoDate(geometry.date) }))
      .filter(item => item.date)
      .sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!));
    const selected = dated[0]?.geometry ?? geometries[geometries.length - 1];
    const anchor = geometryAnchor(selected);
    const occurredAt = dated[0]?.date ?? isoDate(event.closed);
    if (!title || !anchor || !occurredAt) return [];
    const hazardType = eonetHazard(event.categories, title);
    if (!["flood", "landslide", "cyclone", "cloudburst", "extreme-weather"].includes(hazardType)) return [];
    const magnitude = finite(selected?.magnitudeValue);
    const sources = Array.isArray(event.sources) ? event.sources.map(record) : [];
    const sourceUrl = sources.map(source => safeUrl(source.url)).find(Boolean) ?? safeUrl(event.link);
    if (!sourceUrl) return [];
    const endedAt = isoDate(event.closed);
    return [{
      id: `eonet-${String(event.id || title)}`,
      hazardType,
      title,
      description: cleanText(event.description, 600) || "NASA EONET curated event metadata; open the linked source for the original event report.",
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      place: title,
      occurredAt,
      ...(endedAt ? { endedAt } : {}),
      source: "NASA EONET / GDACS" as const,
      sourceUrl,
      kind: "observed" as const,
      status: endedAt ? "ended" as const : "ongoing" as const,
      severity: eonetSeverity(hazardType, magnitude, !endedAt),
      locationPrecision: anchor.precision,
      ...(magnitude !== null ? { magnitude, magnitudeUnit: cleanText(selected?.magnitudeUnit, 30) || undefined } : {}),
    }];
  });
}

function eonetQuery(category: string, options: Record<string, string>) {
  const url = new URL("https://eonet.gsfc.nasa.gov/api/v3/events");
  url.search = new URLSearchParams({ category, status: "all", bbox: "67,38,98,6", ...options }).toString();
  return url;
}

function getEonetCategory(category: string, options: Record<string, string>) {
  return cachedProvider<DisasterOccurrence[]>(
    `eonet:${category}:${JSON.stringify(options)}`,
    "NASA EONET / GDACS",
    30 * 60_000,
    [],
    async () => parseEonetEvents(await fetchJson(eonetQuery(category, options), { timeoutMs: 20_000, maxBytes: 4_000_000 })),
    "NASA EONET curated natural-event metadata with links to originating sources such as GDACS."
  );
}

function quakeOccurrence(event: EarthquakeEvent): DisasterOccurrence {
  const severity: Severity = event.magnitude >= 6 ? "severe" : event.magnitude >= 5 ? "high" : event.magnitude >= 4 ? "moderate" : "low";
  return {
    id: `usgs-${event.id}`,
    hazardType: "earthquake",
    title: `M${event.magnitude.toFixed(1)} earthquake`,
    description: `Observed seismic event at ${event.depthKm.toFixed(1)} km depth. Epicentral location does not describe local shaking intensity.`,
    latitude: event.latitude,
    longitude: event.longitude,
    place: event.place,
    occurredAt: event.time,
    source: "USGS",
    sourceUrl: event.sourceUrl,
    kind: "observed",
    status: "recent",
    severity,
    locationPrecision: "point",
    magnitude: event.magnitude,
    magnitudeUnit: "Mw / reported magnitude",
  };
}

function combinedStatus(results: Array<SourceResult<unknown>>): DisasterOccurrenceFeed["status"] {
  if (results.some(result => result.status === "live")) return "live";
  if (results.some(result => result.status === "cached")) return "cached";
  if (results.some(result => result.status === "stale")) return "stale";
  return "unavailable";
}

export async function getDisasterOccurrences(): Promise<DisasterOccurrenceFeed> {
  const [earthquakes, eonetRecent, eonetLandslides] = await Promise.all([
    getEarthquakes(),
    getEonetCategory("floods,severeStorms", { days: "730", limit: "45" }),
    getEonetCategory("landslides", { limit: "20" }),
  ]);
  const liveResults: Array<SourceResult<unknown>> = [earthquakes, eonetRecent, eonetLandslides];
  const unique = new Map<string, DisasterOccurrence>();
  [...earthquakes.data.map(quakeOccurrence), ...eonetRecent.data, ...eonetLandslides.data, ...VERIFIED_REFERENCE_EVENTS]
    .forEach(event => unique.set(event.id, event));
  return {
    data: [...unique.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    status: combinedStatus(liveResults),
    fetchedAt: new Date().toISOString(),
    coverage: "India and the surrounding seismic and river-basin region; source coverage is not exhaustive.",
    sources: [
      { name: "USGS", status: earthquakes.status, note: "Observed earthquakes from the latest 30 days." },
      { name: "NASA EONET / GDACS", status: combinedStatus([eonetRecent, eonetLandslides]), note: "Curated floods, landslides and severe storms." },
      { name: "Government of India / PIB", status: "historical", note: "Verified reference incidents used for historical context." },
    ],
  };
}
