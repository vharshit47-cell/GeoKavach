import { createHash } from "node:crypto";
import type { LocationPoint, NewsArticle } from "@/types/intelligence";
import { array, cachedProvider, cleanText, fetchJson, hazardFromText, isoDate, ProviderError, rateLimit, record, safeUrl } from "./core";
const majorDomains = ["reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "thehindu.com", "indianexpress.com", "ndtv.com", "hindustantimes.com", "timesofindia.indiatimes.com", "ptinews.com", "pib.gov.in"];
function gdeltDate(value: unknown) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return match ? isoDate(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`) || null : isoDate(value) || null;
}
export function normalizeNews(input: unknown, locationLabel = "India"): NewsArticle[] {
  const data = record(input);
  if (!Array.isArray(data.articles)) throw new ProviderError("News provider returned an invalid response");
  const seenUrls = new Set<string>(); const seenTitles = new Set<string>();
  return array(data.articles).flatMap(value => {
    const item = record(value); const sourceUrl = safeUrl(item.url); const title = cleanText(item.title, 500);
    if (!sourceUrl || !title) return [];
    const url = new URL(sourceUrl); url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    const titleKey = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (seenUrls.has(url.href) || seenTitles.has(titleKey)) return [];
    seenUrls.add(url.href); seenTitles.add(titleKey);
    const source = url.hostname.replace(/^www\./, "");
    return [{ id: createHash("sha256").update(url.href).digest("hex").slice(0, 20), kind: "reported" as const, title, source, sourceUrl: url.href,
      publishedAt: gdeltDate(item.seendate), imageUrl: safeUrl(item.socialimage), hazardType: hazardFromText(title), locationLabel, distanceKm: null,
      locationPrecision: "text-match" as const, reliability: majorDomains.some(domain => source === domain || source.endsWith(`.${domain}`)) ? "major-news-source" as const : "other-report" as const,
      clusterKey: titleKey.split(" ").filter(word => word.length > 3).sort().slice(0, 6).join("-") }];
  });
}
export async function getNews(location?: Partial<LocationPoint>, limit = 15) {
  const state = (location?.state || "").replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80);
  const district = (location?.district || "").replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80);
  const label = [district, state].filter(Boolean).join(", ") || "India";
  const result = await cachedProvider(`gdelt:${label.toLowerCase()}`, "GDELT", 15 * 60_000, [] as NewsArticle[], async () => {
    if (!rateLimit("provider:gdelt", 1, 5500)) throw new ProviderError("News search is cooling down; retry later");
    const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    const geographic = district ? `"${district}"` : state ? `"${state}"` : "India";
    url.search = new URLSearchParams({ query: `(flood OR flooding OR "flash flood" OR cloudburst OR landslide OR earthquake OR cyclone OR storm OR "heavy rainfall" OR avalanche OR wildfire OR "forest fire" OR drought OR "bridge collapse" OR "building collapse") ${geographic} India`, mode: "ArtList", format: "json", maxrecords: "50", timespan: "3d", sort: "DateDesc" }).toString();
    return normalizeNews(await fetchJson(url), label);
  }, "News reports are unverified incident intelligence, never official warnings. GDELT DOC does not provide event coordinates: radius filtering and exact distances are unavailable. Time is GDELT first-seen time, not necessarily publication time.");
  return { ...result, data: result.data.slice(0, limit) };
}
