import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { BoundaryData, LocationPoint, SourceResult } from "@/types/intelligence";
import { cachedProvider, fetchJson, ProviderError, record } from "./core";
import { pointInRing } from "./ndma";

export function geometryContains(geometry: Geometry, lon: number, lat: number): boolean {
  const inPolygon = (rings: Position[][]) => !!rings.length && pointInRing(lon, lat, rings[0]) && !rings.slice(1).some(ring => pointInRing(lon, lat, ring));
  return geometry.type === "Polygon" ? inPolygon(geometry.coordinates) : geometry.type === "MultiPolygon" ? geometry.coordinates.some(inPolygon) : false;
}
export function featureCenter(feature: Feature<Geometry>): [number, number] {
  const geometry = feature.geometry;
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];
  const points = rings.flat();
  if (!points.length) return [78, 22];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}
function boundaryName(feature: Feature<Geometry>) { return String(feature.properties?.shapeName || feature.properties?.name || "Unknown"); }
const normalizeState = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "").replace(/^nctof/, "");
export async function getBoundaries(level: BoundaryData["level"] = "ADM1", state?: string): Promise<SourceResult<BoundaryData | null>> {
  const result = await cachedProvider<BoundaryData | null>(`boundary:${level}`, "geoBoundaries / DataMeet", 7 * 86400_000, null, async () => {
    const metadata = record(await fetchJson(`https://www.geoboundaries.org/api/current/gbOpen/IND/${level}/`));
    const path = String(metadata.simplifiedGeometryGeoJSON || "");
    const url = new URL(path);
    if (url.protocol !== "https:" || !["github.com", "raw.githubusercontent.com", "media.githubusercontent.com"].includes(url.hostname) || !url.pathname.includes("/wmgeolab/geoBoundaries/") || !url.pathname.endsWith(".geojson")) throw new ProviderError("Boundary provider returned an unsupported file URL");
    const raw = record(await fetchJson(url, { maxBytes: 16_000_000, timeoutMs: 20_000 }));
    if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) throw new ProviderError("Invalid boundary geometry");
    const features = (raw.features as Feature<Geometry>[]).filter(feature => feature?.type === "Feature" && ["Polygon", "MultiPolygon"].includes(feature.geometry?.type));
    const geojson: FeatureCollection<Geometry> = { type: "FeatureCollection", features };
    const names = features.map(feature => { const [longitude, latitude] = featureCenter(feature); return { id: String(feature.properties?.shapeID || boundaryName(feature)), name: boundaryName(feature), latitude, longitude }; });
    return { geojson, names, level, license: String(metadata.boundaryLicense || "See geoBoundaries source license"), boundaryYear: String(metadata.boundaryYearRepresented || "Unknown") };
  }, "Reference GIS boundaries from geoBoundaries and its attributed sources. Historical vintages may omit district changes. This is not a legal or authoritative national boundary representation.");
  if (!result.data || level !== "ADM2" || !state) return result;
  const states = await getBoundaries("ADM1");
  const stateFeature = states.data?.geojson.features.find(feature => normalizeState(boundaryName(feature)) === normalizeState(state));
  if (!stateFeature) return { ...result, data: { ...result.data, names: [], geojson: { type: "FeatureCollection" as const, features: [] } }, note: "Selected state is unavailable in this historical boundary vintage. Use manual city/district search." };
  const features = result.data.geojson.features.filter(feature => {
    const [lon, lat] = featureCenter(feature);
    return geometryContains(stateFeature.geometry, lon, lat);
  });
  const names = result.data.names.filter(name => features.some(feature => String(feature.properties?.shapeID || boundaryName(feature)) === name.id));
  return { ...result, data: { ...result.data, names, geojson: { type: "FeatureCollection" as const, features } } };
}
export async function reverseFromBoundaries(latitude: number, longitude: number): Promise<LocationPoint[]> {
  const [states, districts] = await Promise.all([getBoundaries("ADM1"), getBoundaries("ADM2")]);
  const state = states.data?.geojson.features.find(feature => geometryContains(feature.geometry, longitude, latitude));
  const district = districts.data?.geojson.features.find(feature => geometryContains(feature.geometry, longitude, latitude));
  if (!state && !district) throw new ProviderError("Administrative place lookup unavailable; coordinates remain usable");
  return [{ latitude, longitude, ...(state ? { state: boundaryName(state) } : {}), ...(district ? { district: boundaryName(district) } : {}), name: [district && boundaryName(district), state && boundaryName(state)].filter(Boolean).join(", ") }];
}
