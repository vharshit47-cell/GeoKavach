import test from "node:test";
import assert from "node:assert/strict";
import { relocationDecision } from "../src/shared/config/relocation";
import { allocatePopulation, calculateSiteSuitability } from "../src/shared/relocation/planning";
import type { SafeSiteCandidate } from "../src/shared/types/relocation";

const candidate = (id: string, availableCapacity: number, eligible = true): SafeSiteCandidate => ({
  id, name: `TEST ONLY ${id}`, latitude: 30, longitude: 79, source: "Saved field assessment",
  fieldVerified: true, verifiedCapacity: true, maximumCapacity: availableCapacity,
  currentOccupancy: 0, availableCapacity, straightLineDistanceKm: 1,
  safetyScore: 100, suitabilityScore: 90, suitabilityComponents: { safety: 100 },
  confidence: eligible ? "supported" : "insufficient", eligible, reasons: [], warnings: [],
});

test("relocation decision thresholds are deterministic", () => {
  assert.equal(relocationDecision(25).priority, "NONE");
  assert.equal(relocationDecision(26).priority, "MONITOR");
  assert.equal(relocationDecision(51).priority, "PREPARE");
  assert.equal(relocationDecision(76).priority, "IMMEDIATE");
});

test("multi-site allocation never invents capacity or over-allocates", () => {
  const result = allocatePopulation(5000, [candidate("a", 2500), candidate("b", 1700), candidate("rejected", 900, false), candidate("c", 1400)]);
  assert.deepEqual(result, [
    { siteId: "a", allocatedPopulation: 2500 },
    { siteId: "b", allocatedPopulation: 1700 },
    { siteId: "c", allocatedPopulation: 800 },
  ]);
  assert.equal(result.reduce((sum, item) => sum + item.allocatedPopulation, 0), 5000);
});

test("suitability uses only available components", () => {
  assert.equal(calculateSiteSuitability({ safety: 80, capacity: 100 }).totalScore, 88);
  assert.equal(calculateSiteSuitability({}).totalScore, undefined);
});
