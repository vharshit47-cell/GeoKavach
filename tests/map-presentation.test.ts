import test from "node:test";
import assert from "node:assert/strict";
import { alertAnchor, alertRegions, mapAlerts, regionalAlertGroups, caseValue, clusterCases, inViewport, relocationLink, riskStyle } from "../src/frontend/lib/map/presentation";
import { risk, type CaseRecord } from "../src/shared/workflow/model";
import type { DisasterAlert } from "../src/shared/types/intelligence";

// Isolated unit inputs only. Never loaded by the application or a provider.
const record: CaseRecord = { id: "unit-record", version: 1, name: "Unit test", latitude: 25, longitude: 80, population: 100, vulnerable: 70, history: 0, hazards: { flood: 5, landslide: 0, coastalErosion: 0, cloudburst: 0 }, evidence: "Unit test evidence", assessedAt: "2026-09-08", createdAt: "2026-09-08", updatedAt: "2026-09-08" };

test("map display bands never change the workflow red-zone threshold", () => {
  assert.equal(risk(record).score, 76);
  assert.equal(risk(record).redZone, true);
  assert.equal(riskStyle(76).label, "High");
  assert.equal(caseValue(record, "multi"), risk(record).score);
  assert.equal(riskStyle(null).label, "Unassessed");
});
test("unavailable hazard values stay null, and native field intensities round-trip", () => {
  assert.equal(caseValue(record, "earthquake"), null);
  assert.equal(caseValue(record, "cyclone"), null);
  assert.equal(caseValue(record, "flood")! / 20, record.hazards.flood);
  assert.equal(caseValue(record, "landslide"), 0);
});
test("overview clustering conserves population and references original records", () => {
  const second = { ...record, id: "unit-record-2", population: 37, vulnerable: 0, latitude: 25.01 };
  const clusters = clusterCases([record, second], 4, "all");
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].population, 137);
  assert.deepEqual(clusters[0].records, [record, second]);
  assert.equal(clusters[0].score, risk(record).score);
});
test("map does not manufacture geometry for a warning without coordinates", () => {
  assert.equal(alertAnchor({} as DisasterAlert), null);
  assert.deepEqual(alertAnchor({ polygons: [[[80, 25], [81, 25], [81, 26], [80, 25]]] } as DisasterAlert), { latitude: 25.25, longitude: 80.5 });
});
test("viewport filtering rejects invalid and out-of-view points", () => {
  const viewport = { north: 26, south: 24, east: 81, west: 79, zoom: 10 };
  assert.equal(inViewport(record, viewport), true);
  assert.equal(inViewport({ ...record, latitude: 28 }, viewport), false);
  assert.equal(inViewport({ ...record, latitude: NaN }, null), false);
});
test("relocation links preserve and encode the existing record identifier", () => {
  assert.equal(new URL(relocationLink(record), "http://localhost").searchParams.get("habitation"), record.id);
  assert.equal(relocationLink(), "/relocation");
});

const warning: DisasterAlert = { id: "test-warning", source: "NDMA SACHET", kind: "official", isOfficial: true, hazardType: "flood", title: "Test warning", description: "", severity: "severe", publishedAt: "2026-09-11T00:00:00Z", active: true, priority: "P1", locationMatch: "unknown", affectedArea: "4 districts of Andhra Pradesh" };

test("missing provider polygons produce regional references without inventing hazard coordinates", () => {
  assert.deepEqual(alertRegions(warning).map(region => region.name), ["Andhra Pradesh"]);
  assert.equal(alertAnchor(warning), null);
  assert.equal(warning.latitude, undefined);
  assert.equal(warning.locationMatch, "unknown");
  const groups = regionalAlertGroups([warning, { ...warning, id: "second" }, { ...warning, id: "expired", active: false }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].records.length, 2);
});

test("regional references use the affected area, never the issuing office or headline", () => {
  assert.deepEqual(alertRegions({ ...warning, affectedArea: "Unknown area", issuingAuthority: "Andhra Pradesh SDMA", title: "Alert from Delhi" }), []);
  assert.deepEqual(alertRegions({ ...warning, affectedArea: "Goaltore" }), []);
  assert.deepEqual(alertRegions({ ...warning, affectedArea: "Assam and Meghalaya" }).map(region => region.name), ["Assam", "Meghalaya"]);
  assert.deepEqual(alertRegions({ ...warning, latitude: 15, longitude: 80 }), []);
  assert.deepEqual(alertRegions({ ...warning, polygons: [[[80, 15], [81, 15], [80, 16], [80, 15]]] }), []);
});

test("selecting a point keeps nationwide hazards and merges local CAP details", () => {
  const rss = { ...warning, id: "rss-id", sourceUrl: "https://example.test/cap", active: false };
  const cap = { ...rss, id: "cap-id", active: true, endTime: "2099-09-12T00:00:00Z" };
  assert.deepEqual(mapAlerts([warning, rss], [cap], "all"), [warning, cap]);
  assert.deepEqual(mapAlerts([warning], [], "all"), [warning]);
  assert.deepEqual(mapAlerts([warning], [], "earthquake"), []);
  assert.deepEqual(mapAlerts([{ ...warning, active: false }], [], "all"), []);
});

test("map merging retains precise geometry when local warnings have no boundary", () => {
  const precise = { ...warning, latitude: 15, longitude: 80 };
  assert.deepEqual(mapAlerts([precise], [warning], "all"), [precise]);
  assert.deepEqual(mapAlerts([warning], [precise], "all"), [precise]);
});
