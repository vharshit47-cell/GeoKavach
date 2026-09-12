import type { EarthquakeEvent, LocationPoint } from "@/types/intelligence";
import { haversineDistanceKm } from "@/lib/server/distance";
import { cachedProvider, fetchJson, finite, record, safeUrl } from "./core";

/** Approximate geographic bounds for India and seismically relevant surrounding regions. */
const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 38,
  minLon: 68,
  maxLon: 98,
} as const;

/**
 * Pure normalizer — converts a raw USGS GeoJSON FeatureCollection into EarthquakeEvent[].
 * Exported for unit tests. Filters to India-region bounding box.
 * Drops events with null/missing magnitude.
 */
export function parseEarthquakes(raw: unknown): EarthquakeEvent[] {
  const data = record(raw);
  if (!Array.isArray(data.features)) return [];

  return (data.features as unknown[]).flatMap((value) => {
    const feature = record(value);
    const props = record(feature.properties);
    const geometry = record(feature.geometry);
    const coords = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];

    const longitude = finite(coords[0]);
    const latitude = finite(coords[1]);
    const depthKm = finite(coords[2]) ?? 0;
    const magnitude = finite(props.mag);
    const time = typeof props.time === "number" ? props.time : null;
    const id = typeof feature.id === "string" ? feature.id : String(feature.id ?? "");

    // Drop events outside India region or with unmeasured magnitude
    if (
      longitude === null ||
      latitude === null ||
      magnitude === null ||
      latitude < INDIA_BOUNDS.minLat ||
      latitude > INDIA_BOUNDS.maxLat ||
      longitude < INDIA_BOUNDS.minLon ||
      longitude > INDIA_BOUNDS.maxLon
    ) {
      return [];
    }

    const url = safeUrl(props.url) ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`;

    return [{
      id,
      source: "USGS" as const,
      kind: "observed" as const,
      magnitude,
      latitude,
      longitude,
      depthKm,
      time: time !== null ? new Date(time).toISOString() : new Date().toISOString(),
      place: typeof props.place === "string" ? props.place : "Unknown region",
      sourceUrl: url,
    }];
  });
}

/**
 * Fetches the latest 30 days of earthquakes from the USGS catalog for the
 * India and near-border region. A bounded catalog query is used so the map is
 * useful even on days without an event inside the regional box.
 * Revalidates every 60 seconds via cachedProvider.
 *
 * @param location  Optional — when provided, attaches distanceKm and filters by radiusKm.
 * @param radiusKm  Maximum distance from location to include (default 300 km).
 */
export function getEarthquakes(location?: LocationPoint, radiusKm = 300) {
  return cachedProvider<EarthquakeEvent[]>(
    // Cache key: location-aware so different radii don't collide
    location
      ? `usgs:earthquakes:${location.latitude.toFixed(1)},${location.longitude.toFixed(1)}:${radiusKm}`
      : "usgs:earthquakes:india",
    "USGS",
    60_000, // 60-second revalidation
    [],
    async () => {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString().slice(0, 10);
      const query = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
      query.search = new URLSearchParams({
        format: "geojson",
        starttime: start,
        minlatitude: String(INDIA_BOUNDS.minLat),
        maxlatitude: String(INDIA_BOUNDS.maxLat),
        minlongitude: String(INDIA_BOUNDS.minLon),
        maxlongitude: String(INDIA_BOUNDS.maxLon),
        minmagnitude: "2",
        orderby: "time",
        limit: "100",
      }).toString();
      const raw = await fetchJson(query, { timeoutMs: 15_000 });
      let events = parseEarthquakes(raw);

      if (location) {
        events = events
          .map((event) => ({
            ...event,
            distanceKm: haversineDistanceKm(
              location.latitude,
              location.longitude,
              event.latitude,
              event.longitude
            ),
          }))
          .filter((event) => event.distanceKm! <= radiusKm);
      }

      return events;
    },
    "USGS earthquake catalog, latest 30 days in the India-region bounding box. Observed seismic events only, not a prediction or shaking assessment."
  );
}
