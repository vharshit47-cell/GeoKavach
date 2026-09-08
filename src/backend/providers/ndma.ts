import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { DisasterAlert, LocationPoint, Severity } from "@/types/intelligence";
import { haversineDistanceKm } from "@/lib/server/distance";
import { array, cachedProvider, cleanText, fetchText, hazardFromText, isoDate, ProviderError, record, safeUrl } from "./core";

const RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml";
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, processEntities: false });
function xml(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new ProviderError("Invalid CAP/RSS response");
  return record(parser.parse(text));
}
export function alertPriority(severity: Severity): DisasterAlert["priority"] {
  return severity === "extreme" ? "P0" : severity === "severe" ? "P1" : severity === "high" ? "P2" : severity === "moderate" ? "P3" : "P4";
}
export function parseRss(text: string): DisasterAlert[] {
  const channel = record(record(xml(text).rss).channel);
  if (!channel.title) throw new ProviderError("NDMA RSS feed is invalid");
  return array(channel.item).slice(0, 100).flatMap(value => {
    const item = record(value); const sourceUrl = safeUrl(item.link); const publishedAt = isoDate(item.pubDate);
    if (!sourceUrl || !publishedAt) return [];
    return [{ id: cleanText(item.guid || sourceUrl, 200), source: "NDMA SACHET" as const, kind: "official" as const, isOfficial: true as const,
      title: cleanText(item.title), description: cleanText(item.description), hazardType: hazardFromText(cleanText(item.title)),
      severity: "unknown" as const, issuingAuthority: cleanText(item.author), publishedAt, sourceUrl,
      locationMatch: "unknown" as const, active: false, priority: "P4" as const }];
  });
}
export function parseCap(text: string, fallback: DisasterAlert, now = Date.now()): DisasterAlert | null {
  const alert = record(xml(text).alert);
  if (!alert.identifier || !alert.info) throw new ProviderError("Invalid CAP alert");
  if (alert.status !== "Actual" || alert.scope !== "Public" || alert.msgType === "Cancel") return null;
  const infos = array(alert.info).map(record);
  const info = infos.find(item => String(item.language).startsWith("en")) || infos[0];
  const areas = array(info.area).map(record);
  const polygons = areas.flatMap(area => array(area.polygon)).flatMap(value => {
    const pairs = String(value).trim().split(/\s+/).map(pair => pair.split(",").map(Number));
    return pairs.length >= 3 && pairs.every(pair => pair.length === 2 && pair.every(Number.isFinite) && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180)
      ? [pairs.map(([lat, lon]) => [lon, lat])] : [];
  });
  const circles = areas.flatMap(area => array(area.circle)).flatMap(value => {
    const [pair, radius] = String(value).trim().split(/\s+/); const [latitude, longitude] = pair.split(",").map(Number); const radiusKm = Number(radius);
    return [latitude, longitude, radiusKm].every(Number.isFinite) && radiusKm >= 0 ? [{ latitude, longitude, radiusKm }] : [];
  });
  const capSeverity = cleanText(info.severity).toLowerCase();
  const severity: Severity = (["minor", "moderate", "severe", "extreme"] as string[]).includes(capSeverity) ? capSeverity === "minor" ? "low" : capSeverity as Severity : "unknown";
  const endTime = isoDate(info.expires); const startTime = isoDate(info.effective || info.onset || alert.sent);
  const affectedArea = areas.map(area => cleanText(area.areaDesc)).filter(Boolean).join("; ");
  const points = polygons.flat();
  return { ...fallback, id: String(alert.identifier), title: cleanText(info.headline) || fallback.title, description: cleanText(info.description),
    hazardType: hazardFromText(`${info.event} ${info.headline}`), severity, urgency: cleanText(info.urgency), certainty: cleanText(info.certainty),
    issuingAuthority: cleanText(info.senderName || alert.sender), action: cleanText(info.instruction), affectedArea, startTime, endTime,
    publishedAt: isoDate(alert.sent) || fallback.publishedAt, polygons, circles,
    ...(points.length ? { latitude: points.reduce((sum, point) => sum + point[1], 0) / points.length, longitude: points.reduce((sum, point) => sum + point[0], 0) / points.length } : {}),
    active: !!endTime && Date.parse(endTime) > now && (!startTime || Date.parse(startTime) <= now), priority: alertPriority(severity) };
}
/** Coordinates are [longitude, latitude]; polygon boundary is treated as included. */
export function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const cross = (lon - xi) * (yj - yi) - (lat - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-9 && lon >= Math.min(xi, xj) && lon <= Math.max(xi, xj) && lat >= Math.min(yi, yj) && lat <= Math.max(yi, yj)) return true;
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function mentions(area: string, place?: string) {
  const tokens = place?.toLocaleLowerCase().replace(/ district$/i, "").trim();
  if (!tokens || tokens.length < 3) return false;
  const escaped = tokens.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, "iu").test(area);
}
export function matchAlert(alert: DisasterAlert, location: LocationPoint): DisasterAlert {
  const hasGeometry = !!alert.polygons?.length || !!alert.circles?.length;
  const inPolygon = alert.polygons?.some(ring => pointInRing(location.longitude, location.latitude, ring));
  const inCircle = alert.circles?.some(circle => haversineDistanceKm(location.latitude, location.longitude, circle.latitude, circle.longitude) <= circle.radiusKm);
  const area = alert.affectedArea || "";
  const locationMatch: DisasterAlert["locationMatch"] = inPolygon || inCircle ? "polygon" : hasGeometry ? "unknown" : mentions(area, location.district) ? "district" : mentions(area, location.state) ? "state" : "unknown";
  return { ...alert, locationMatch,
    ...(locationMatch === "polygon" ? { distanceKm: 0 } : alert.latitude != null && alert.longitude != null ? { distanceKm: haversineDistanceKm(location.latitude, location.longitude, alert.latitude, alert.longitude) } : {}) };
}
const regionIssuers: Record<string, string> = { "uttarakhand": "dehradun", "uttar pradesh": "lucknow", "assam": "guwahati", "odisha": "bhubaneswar", "maharashtra": "mumbai", "tamil nadu": "chennai", "kerala": "thiruvananthapuram", "himachal pradesh": "shimla", "delhi": "delhi", "jharkhand": "ranchi" };
function trustedCap(url?: string): url is string {
  if (!url) return false;
  const parsed = new URL(url);
  return parsed.origin === "https://sachet.ndma.gov.in" && parsed.pathname === "/cap_public_website/FetchXMLFile" && /^\d{5,30}$/.test(parsed.searchParams.get("identifier") || "");
}
function polygonLink(text: string): string | undefined {
  const info = array(record(xml(text).alert).info).map(record);
  const parameter = info.flatMap(item => array(item.parameter).map(record)).find(item => item.valueName === "Polygon URL");
  const url = safeUrl(parameter?.value);
  if (!url) return;
  const parsed = new URL(url);
  return parsed.origin === "https://sachet.ndma.gov.in" && parsed.pathname === "/cap_public_website/FetchPolygonXMLFile" && /^\d{5,30}$/.test(parsed.searchParams.get("identifier") || "") ? url : undefined;
}
export function parseLinkedPolygons(text: string): number[][][] {
  const alert = record(xml(text).alert);
  return array(alert.polygon).flatMap(value => {
    const pairs = String(value).trim().split(/\s+/).map(pair => pair.split(",").map(Number));
    return pairs.length >= 3 && pairs.every(pair => pair.length === 2 && pair.every(Number.isFinite) && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180) ? [pairs.map(([lat, lon]) => [lon, lat])] : [];
  });
}
/** The full ring remains cached for matching; only map output is downsampled. */
function displayPolygons(polygons?: number[][][]) {
  return polygons?.map(ring => {
    const stride = Math.max(1, Math.ceil(ring.length / 500));
    const result = ring.filter((_, index) => index % stride === 0);
    if (result.length && (result[0][0] !== result[result.length - 1][0] || result[0][1] !== result[result.length - 1][1])) result.push(result[0]);
    return result;
  });
}
export async function getAlerts(location?: LocationPoint) {
  const feed = await cachedProvider("ndma:rss", "NDMA SACHET", 2 * 60_000, [] as DisasterAlert[], async () => parseRss(await fetchText(RSS_URL)));
  if (!feed.data.length) return feed;
  const issuer = regionIssuers[location?.state?.toLowerCase() || ""];
  const relevant = location ? feed.data.filter(alert => mentions(`${alert.title} ${alert.issuingAuthority}`, location.state) || mentions(alert.title, location.district) || (issuer && alert.issuingAuthority?.toLowerCase().includes(issuer))) : [];
  const selected = [...new Map([...relevant.slice(0, 8), ...feed.data.slice(0, 8)].map(item => [item.id, item])).values()];
  const enriched = new Map<string, DisasterAlert | null>();
  // Four bounded workers; one CAP document per item, no website crawling or untrusted URLs.
  let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < selected.length) {
      const itemIndex = index++;
      const item = selected[itemIndex];
      if (!trustedCap(item.sourceUrl)) continue;
      const result = await cachedProvider(`ndma:cap:${item.id}`, "NDMA SACHET", 10 * 60_000, item as DisasterAlert | null, async () => {
        const text = await fetchText(item.sourceUrl!, { timeoutMs: 5000 });
        const parsed = parseCap(text, item);
        // Only four linked geometries per refresh; each can contain tens of thousands of coordinates.
        const link = itemIndex < 4 && parsed && !parsed.polygons?.length ? polygonLink(text) : undefined;
        if (parsed && link) {
          try {
            const polygons = parseLinkedPolygons(await fetchText(link, { timeoutMs: 5000, maxBytes: 2_000_000 }));
            if (polygons.length) {
              const points = polygons.flat();
              return { ...parsed, polygons, latitude: points.reduce((sum, p) => sum + p[1], 0) / points.length, longitude: points.reduce((sum, p) => sum + p[0], 0) / points.length };
            }
          } catch { /* CAP area descriptions remain valid if the optional geometry endpoint fails. */ }
        }
        return parsed;
      });
      if (["live", "cached"].includes(result.status)) enriched.set(item.id, result.data);
    }
  }));
  const normalized = feed.data.flatMap(item => {
    const enrichedItem = enriched.has(item.id) ? enriched.get(item.id) : item;
    if (!enrichedItem) return [];
    const current = { ...enrichedItem, active: !!enrichedItem.endTime && Date.parse(enrichedItem.endTime) > Date.now() && (!enrichedItem.startTime || Date.parse(enrichedItem.startTime) <= Date.now()) };
    const matched = location ? matchAlert(current, location) : current;
    return [{ ...matched, polygons: displayPolygons(matched.polygons) }];
  });
  normalized.sort((a, b) => Number(b.active) - Number(a.active) || Number(a.priority.slice(1)) - Number(b.priority.slice(1)) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return { ...feed, data: location ? normalized.filter(item => item.locationMatch !== "unknown" || relevant.some(r => r.sourceUrl === item.sourceUrl)).slice(0, 40) : normalized,
    note: "NDMA SACHET public RSS/CAP. Bounded latest feed coverage; up to 16 CAP details and 4 linked polygons checked. Map polygons are generalized; point matching uses full source geometry. RSS-only items have unknown severity/expiry and are not counted as active. State-only matches are regional advisories, not confirmation at your point. Follow the original authority for complete warnings." };
}
