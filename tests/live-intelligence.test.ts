import test from "node:test";
import assert from "node:assert/strict";
import { parseCap, parseRss, matchAlert, pointInRing, parseLinkedPolygons } from "../src/backend/providers/ndma";
import { parseWeather } from "../src/backend/providers/weather";
import { parseEarthquakes } from "../src/backend/providers/earthquake";
import { normalizeNews } from "../src/backend/providers/gdelt";
import { parseFacilities } from "../src/backend/providers/osm";
import { parseCsvRow } from "../src/backend/providers/groundwater";
import { cachedProvider, safeUrl, rateLimit, unavailable } from "../src/backend/providers/core";
import { calculateLiveRisk } from "../src/backend/services/location-intelligence";
import { locationInput, boundedNumber, liveRoute } from "../src/backend/controllers/live-api";
import type { DisasterAlert, LocationIntelligence, SourceResult } from "../src/shared/types/intelligence";

const now = Date.parse("2026-09-06T18:00:00Z");
const fallback: DisasterAlert = { id: "test", source: "NDMA SACHET", kind: "official", isOfficial: true, title: "RSS title", description: "", hazardType: "other", severity: "unknown", publishedAt: "2026-09-06T17:00:00Z", locationMatch: "unknown", active: false, priority: "P4" };
const cap = `<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><cap:identifier>IN-123</cap:identifier><cap:status>Actual</cap:status><cap:scope>Public</cap:scope><cap:msgType>Alert</cap:msgType><cap:sent>2026-09-06T22:30:00+05:30</cap:sent><cap:info><cap:language>en-IN</cap:language><cap:event>Rainfall</cap:event><cap:headline>Rainfall warning</cap:headline><cap:severity>Severe</cap:severity><cap:effective>2026-09-06T22:30:00+05:30</cap:effective><cap:expires>2026-09-07T02:09:00+05:30</cap:expires><cap:instruction>Follow authority guidance.</cap:instruction><cap:area><cap:areaDesc>Lucknow district of Uttar Pradesh</cap:areaDesc><cap:polygon>26,80 28,80 28,82 26,82 26,80</cap:polygon></cap:area></cap:info></cap:alert>`;
const live = <T>(data: T, source: string): SourceResult<T> => ({ data, source, attribution: source, status: "live", fetchedAt: new Date(now).toISOString() });
const inputs = (): Pick<LocationIntelligence, "alerts" | "weather" | "earthquakes"> => ({ alerts: live([], "NDMA SACHET"), weather: live(null, "Open-Meteo"), earthquakes: live([], "USGS") });

test("CAP parses namespaces, authority severity, timestamps and polygon coordinate order", () => {
  const result = parseCap(cap, fallback, now)!;
  assert.equal(result.severity, "severe"); assert.equal(result.active, true); assert.equal(result.priority, "P1");
  assert.equal(result.endTime, "2026-09-06T20:39:00.000Z"); assert.deepEqual(result.polygons![0][0], [80, 26]);
  assert.equal(matchAlert(result, { latitude: 27, longitude: 81 }).locationMatch, "polygon");
});
test("CAP test, cancelled and expired messages never become active emergencies", () => {
  assert.equal(parseCap(cap.replace("Actual", "Test"), fallback, now), null);
  assert.equal(parseCap(cap.replace("<cap:msgType>Alert", "<cap:msgType>Cancel"), fallback, now), null);
  assert.equal(parseCap(cap, fallback, now + 86400_000)!.active, false);
});
test("CAP rejects entities and malformed input instead of interpreting external entities", () => {
  assert.throws(() => parseCap('<!DOCTYPE alert [<!ENTITY x SYSTEM "file:///etc/passwd">]><alert>&x;</alert>', fallback));
  assert.throws(() => parseCap("<alert>", fallback));
});
test("NDMA linked polygon document keeps source coordinate order and rejects bad vertices", () => {
  assert.deepEqual(parseLinkedPolygons("<alert><identifier>IN-123</identifier><polygon>26,80 28,80 28,82 26,80</polygon></alert>")[0][0], [80, 26]);
  assert.deepEqual(parseLinkedPolygons("<alert><polygon>91,80 28,80 28,82</polygon></alert>"), []);
});
test("RSS unknown expiry/severity stays informational", () => {
  const [item] = parseRss(`<rss><channel><title>Official</title><item><guid>123</guid><title>Severe flood headline</title><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=12345</link><pubDate>Sun, 06 Sep 2026 17:00:00 GMT</pubDate></item></channel></rss>`);
  assert.equal(item.active, false); assert.equal(item.severity, "unknown");
});
test("outside CAP polygon cannot become district match; exact district boundary matching avoids substring errors", () => {
  const item = parseCap(cap, fallback, now)!;
  assert.equal(matchAlert(item, { latitude: 30, longitude: 84, district: "Lucknow" }).locationMatch, "unknown");
  assert.equal(matchAlert({ ...item, polygons: [], affectedArea: "East Delhi district" }, { latitude: 28, longitude: 77, district: "New Delhi" }).locationMatch, "unknown");
  assert.equal(pointInRing(80, 26, item.polygons![0]), true);
});
test("null weather readings are not fabricated as zero", () => {
  const weather = parseWeather({ latitude: 27, longitude: 81, current: { time: "2026-09-06T18:00", precipitation: null }, daily: { time: ["2026-09-06"], precipitation_sum: [null] } });
  assert.equal(weather.precipitationMm, null); assert.equal(weather.forecast[0].precipitationMm, null); assert.equal(weather.kind, "model-derived");
});
test("earthquake parser drops records without measured magnitude", () => {
  assert.deepEqual(parseEarthquakes({ type: "FeatureCollection", features: [{ id: "a", properties: { mag: null, time: now, url: "https://earthquake.usgs.gov/" }, geometry: { coordinates: [80, 27, 10] } }] }), []);
});
test("news deduplicates tracking URLs and titles, never fabricates distance", () => {
  const articles = normalizeNews({ articles: [{ title: "Flood reported", url: "https://reuters.com/a?utm_source=x", seendate: "20260906T170000Z" }, { title: "Flood reported", url: "https://reuters.com/a?utm_source=y" }, { title: "Unsafe URL", url: "javascript:alert(1)" }] });
  assert.equal(articles.length, 1); assert.equal(articles[0].distanceKm, null); assert.equal(articles[0].kind, "reported"); assert.equal(articles[0].reliability, "major-news-source");
});
test("mapped capacity and shelter status remain unverified", () => {
  const [site] = parseFacilities({ elements: [{ type: "node", id: 1, lat: 27, lon: 81, tags: { amenity: "school", capacity: "1000", name: "School" } }] }, 27, 81);
  assert.equal(site.capacity, null); assert.equal(site.verifiedShelter, false); assert.equal(site.riskLevel, "unassessed");
});
test("all provider failures yield UNKNOWN with no numerical risk", () => {
  const risk = calculateLiveRisk({ alerts: unavailable("NDMA", []), weather: unavailable("Weather", null), earthquakes: unavailable("USGS", []) }, now);
  assert.equal(risk.score, null); assert.equal(risk.status, "UNKNOWN");
});
test("severe point-applicable official alert outranks secondary evidence; stale alert excluded", () => {
  const data = inputs(); data.alerts.data = [matchAlert(parseCap(cap, fallback, now)!, { latitude: 27, longitude: 81 })];
  assert.equal(calculateLiveRisk(data, now).status, "SEVERE_ALERT");
  assert.equal(calculateLiveRisk(data, now).score, 75);
  data.alerts.status = "stale"; assert.equal(calculateLiveRisk(data, now).status, "UNKNOWN");
});
test("state-only official warning has capped triage and no exact emergency claim", () => {
  const data = inputs(); data.alerts.data = [{ ...parseCap(cap, fallback, now)!, locationMatch: "state" }];
  const risk = calculateLiveRisk(data, now); assert.equal(risk.status, "WATCH"); assert.equal(risk.score, 25);
});
test("provider cache coalesces requests and failure cooldown is bounded", async () => {
  let calls = 0; const fetcher = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return [1]; };
  const results = await Promise.all([cachedProvider("test-cache", "Test", 500, [], fetcher), cachedProvider("test-cache", "Test", 500, [], fetcher)]);
  assert.equal(calls, 1); assert.deepEqual(results[0].data, [1]);
  let errors = 0; const failed = () => { errors++; return Promise.reject(new Error("secret stack")); };
  const failure = await cachedProvider("test-failure", "Test", 500, [], failed);
  await cachedProvider("test-failure", "Test", 500, [], failed);
  assert.equal(errors, 1); assert.equal(failure.status, "unavailable"); assert.equal(failure.error?.includes("secret"), false);
});
test("inputs reject missing halves, out-of-India coordinates, NaN and oversized radius", () => {
  assert.throws(() => locationInput(new URLSearchParams("lat=28")));
  assert.throws(() => locationInput(new URLSearchParams("lat=0&lon=0")));
  assert.throws(() => boundedNumber(new URLSearchParams("radius=Infinity"), "radius", 1, 100));
  assert.equal(locationInput(new URLSearchParams(), true), undefined);
});
test("HTTP route returns 400 for bad location and 429 for exhausted budget", async () => {
  const route = liveRoute(async params => locationInput(params), 2);
  const url = "http://localhost/api/test-budget?lat=abc&lon=80";
  assert.equal((await route(new Request(url))).status, 400);
  await route(new Request(url)); const response = await route(new Request(url));
  assert.equal(response.status, 429); assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(rateLimit("test-unit-budget", 1), true); assert.equal(rateLimit("test-unit-budget", 1), false);
});
test("CSV parser preserves quoted commas and escaped quotation marks", () => {
  assert.deepEqual(parseCsvRow('a,"district, name","a""b",4'), ["a", "district, name", 'a"b', "4"]);
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
});
