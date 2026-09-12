import type { NearbyFacility } from "@/types/intelligence";
import { haversineDistanceKm } from "@/lib/server/distance";
import { cachedProvider, cleanText, coordinateKey, fetchJson, finite, ProviderError, rateLimit, record } from "./core";
export function parseFacilities(value: unknown, latitude: number, longitude: number): NearbyFacility[] {
  const data = record(value);
  if (!Array.isArray(data.elements)) throw new ProviderError("Invalid infrastructure response");
  return data.elements.flatMap((value: unknown) => {
    const item = record(value); const tags = record(item.tags); const center = record(item.center);
    const lat = finite(item.lat ?? center.lat); const lon = finite(item.lon ?? center.lon);
    if (lat === null || lon === null || !item.id || !["node", "way", "relation"].includes(String(item.type))) return [];
    const type = cleanText(tags.amenity || tags.emergency || "facility", 80);
    return [{ id: `${item.type}/${item.id}`, name: cleanText(tags.name || tags["name:en"] || type.replace(/_/g, " "), 200), latitude: lat, longitude: lon, type,
      distanceKm: haversineDistanceKm(latitude, longitude, lat, lon), capacity: null, capacityStatus: "unknown" as const, riskLevel: "unassessed" as const,
      reason: "Nearby mapped facility. Opening status, disaster suitability, route access and capacity require local confirmation.",
      source: "OpenStreetMap" as const, kind: "reported" as const, sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
      phone: cleanText(tags["contact:phone"] || tags.phone, 100) || undefined, wheelchair: cleanText(tags.wheelchair, 60) || undefined,
      access: cleanText(tags.access, 60) || undefined, verifiedShelter: false as const }];
  }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 60);
}
export async function getNearbyFacilities(latitude: number, longitude: number, radiusKm = 10) {
  const radius = Math.min(30, Math.max(1, radiusKm));
  const result = await cachedProvider(`osm:${coordinateKey(latitude, longitude)}:${radius}`, "OpenStreetMap", 6 * 60 * 60_000, [] as NearbyFacility[], async () => {
    if (!rateLimit("provider:overpass", 6, 60_000)) throw new ProviderError("Infrastructure query limit reached; retry later");
    const query = `[out:json][timeout:12];nwr(around:${Math.round(radius * 1000)},${latitude.toFixed(2)},${longitude.toFixed(2)})[amenity~"^(hospital|clinic|police|fire_station|shelter|school|community_centre)$"];out center 80;`;
    const options = { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: query }), timeoutMs: 12_000 };
    try { return parseFacilities(await fetchJson("https://overpass.private.coffee/api/interpreter", options), latitude, longitude); }
    catch { return parseFacilities(await fetchJson("https://overpass-api.de/api/interpreter", options), latitude, longitude); }
  }, "© OpenStreetMap contributors · ODbL. Candidate facilities only; none is certified safe or a confirmed evacuation shelter. Capacity is unknown. Search is limited to 30 km and 80 mapped results.");
  return { ...result, data: result.data.map(site => ({ ...site, distanceKm: haversineDistanceKm(latitude, longitude, site.latitude, site.longitude) })).filter(site => site.distanceKm <= radius).sort((a, b) => a.distanceKm - b.distanceKm) };
}
