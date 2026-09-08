import type { LocationPoint } from "@/types/intelligence";
import { array, cachedProvider, cleanText, coordinateKey, fetchJson, finite, ProviderError, rateLimit, record } from "./core";
import { reverseFromBoundaries } from "./boundaries";

export function searchLocations(query: string) {
  return cachedProvider(`geocode:search:${query.toLowerCase()}`, "Open-Meteo / GeoNames", 86400_000, [] as LocationPoint[], async () => {
    if (!rateLimit("provider:geocoding", 30, 60_000)) throw new ProviderError("Location search limit reached; retry later");
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({ name: query, count: "10", language: "en", format: "json", countryCode: "IN" }).toString();
    const data = record(await fetchJson(url));
    if (data.error) throw new ProviderError("Location search unavailable");
    return array(data.results).flatMap(value => {
      const item = record(value); const latitude = finite(item.latitude); const longitude = finite(item.longitude);
      if (latitude === null || longitude === null || item.country_code !== "IN") return [];
      return [{ latitude, longitude, name: cleanText(item.name, 160), state: cleanText(item.admin1, 100), district: cleanText(item.admin2, 100) }];
    });
  }, "Place names by GeoNames via Open-Meteo · User-submitted search only; no autocomplete requests.");
}
export function reverseLocation(latitude: number, longitude: number) {
  return cachedProvider(`geocode:reverse:${coordinateKey(latitude, longitude)}`, "geoBoundaries / DataMeet", 86400_000, [] as LocationPoint[], async () => reverseFromBoundaries(latitude, longitude), "Approximate state/district identification using historical boundaries. Confirm the administrative area; coordinates still work independently.");
}
