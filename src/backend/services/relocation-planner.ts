import "server-only";
import * as turf from "@turf/turf";
import { RELOCATION_CONFIG, dominantHazards, relocationDecision } from "@/config/relocation";
import { haversineDistanceKm } from "@/lib/server/distance";
import { capacity, fresh, reservedStatuses, risk, type CaseRecord, type Plan, type SiteRecord } from "@/shared/workflow/model";
import { allocatePopulation, calculateSiteSuitability } from "@/shared/relocation/planning";
import type { DisasterAlert, NearbyFacility, SourceResult } from "@/types/intelligence";
import type { RelocationAssignment, RelocationPlan, RelocationRoute, SafeSiteCandidate, SuitabilityComponents } from "@/types/relocation";
import { getRoadRoute } from "./routing";

type RouteProvider = typeof getRoadRoute;

function clamp(value: number) { return Math.max(0, Math.min(100, value)); }

function pointCoveredBySevereAlert(latitude: number, longitude: number, alerts: DisasterAlert[]) {
  return alerts.some(alert => {
    if (!alert.active || !["severe", "extreme"].includes(alert.severity)) return false;
    const polygonHit = alert.polygons?.some(ring => {
      try { return turf.booleanPointInPolygon(turf.point([longitude, latitude]), turf.polygon([ring])); }
      catch { return false; }
    });
    const circleHit = alert.circles?.some(circle => haversineDistanceKm(latitude, longitude, circle.latitude, circle.longitude) <= circle.radiusKm);
    return polygonHit || circleHit;
  });
}

function committedAtSite(siteId: string, plans: Plan[]) {
  return plans.filter(plan => plan.siteId === siteId && reservedStatuses.includes(plan.status)).reduce((sum, plan) => sum + plan.population, 0);
}

export function evaluateFieldSite(caseRecord: CaseRecord, site: SiteRecord, plans: Plan[], alerts: DisasterAlert[], searchRadiusKm: number): SafeSiteCandidate {
  const maximumCapacity = capacity(site);
  const currentOccupancy = site.occupied + committedAtSite(site.id, plans);
  const availableCapacity = Math.max(0, maximumCapacity - currentOccupancy);
  const straightLineDistanceKm = haversineDistanceKm(caseRecord.latitude, caseRecord.longitude, site.latitude, site.longitude);
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude) || Math.abs(site.latitude) > 90 || Math.abs(site.longitude) > 180) reasons.push("Rejected: invalid site coordinates");
  if (!fresh(caseRecord.assessedAt)) reasons.push("Rejected: habitation assessment is older than 30 days");
  if (!site.verified) reasons.push("Rejected: safety and road access have not been field-verified");
  if (!fresh(site.assessedAt)) reasons.push("Rejected: site assessment is older than 30 days");
  if (site.hazard > RELOCATION_CONFIG.site.maximumFieldHazard) reasons.push(`Rejected: assessed site hazard ${site.hazard}/5 exceeds the ${RELOCATION_CONFIG.site.maximumFieldHazard}/5 screening limit`);
  if (pointCoveredBySevereAlert(site.latitude, site.longitude, alerts)) reasons.push("Rejected: site intersects a currently available severe or extreme NDMA SACHET alert area");
  if (availableCapacity <= 0) reasons.push("Rejected: no verified capacity is currently available");
  if (straightLineDistanceKm > searchRadiusKm) reasons.push(`Rejected: site is outside the ${searchRadiusKm} km search radius`);
  if (availableCapacity > 0 && availableCapacity < caseRecord.population) warnings.push("This site cannot accommodate the full population alone; a multi-site allocation is required");

  const servicesCapacity = Math.min(site.water, site.sanitation, site.shelter);
  const components: SuitabilityComponents = {
    safety: clamp(100 - site.hazard * 20),
    capacity: clamp(availableCapacity / caseRecord.population * 100),
    distance: clamp(100 - straightLineDistanceKm / searchRadiusKm * 100),
    accessibility: site.verified ? 100 : undefined,
    services: clamp(servicesCapacity / caseRecord.population * 100),
  };
  const suitability = calculateSiteSuitability(components);
  const eligible = !reasons.some(reason => reason.startsWith("Rejected:"));
  if (eligible) reasons.push("Eligible: current field evidence supports safety, access and usable capacity");
  return {
    id: site.id, name: site.name, latitude: site.latitude, longitude: site.longitude,
    source: "Saved field assessment", fieldVerified: site.verified, verifiedCapacity: true,
    maximumCapacity, currentOccupancy, availableCapacity,
    straightLineDistanceKm, safetyScore: components.safety, suitabilityScore: suitability.totalScore,
    suitabilityComponents: components, confidence: eligible ? "supported" : "insufficient",
    eligible, reasons: [...reasons, ...suitability.reasons], warnings,
  };
}

export function evaluateOsmCandidate(facility: NearbyFacility, searchRadiusKm: number): SafeSiteCandidate {
  return {
    id: `osm:${facility.id}`, name: facility.name, latitude: facility.latitude, longitude: facility.longitude,
    source: "OpenStreetMap", sourceUrl: facility.sourceUrl, fieldVerified: false, verifiedCapacity: false,
    straightLineDistanceKm: facility.distanceKm, suitabilityComponents: {
      distance: clamp(100 - facility.distanceKm / searchRadiusKm * 100),
    },
    confidence: "insufficient", eligible: false,
    reasons: ["Candidate only: safety, road access and carrying capacity require field verification"],
    warnings: ["Capacity not verified"],
  };
}

function routeHazardCheck(route: RelocationRoute, alerts: SourceResult<DisasterAlert[]>): RelocationRoute {
  const relevant = alerts.data.filter(alert => alert.active && ["severe", "extreme"].includes(alert.severity));
  if (alerts.status === "unavailable") return { ...route, hazardCheck: "not-available", warnings: ["Route hazard intersection could not be checked because the official alert feed is unavailable"] };
  const line = turf.lineString(route.geometry.coordinates);
  const hits = relevant.filter(alert => {
    const polygonHit = alert.polygons?.some(ring => {
      try { return turf.booleanIntersects(line, turf.polygon([ring])); }
      catch { return false; }
    });
    const circleHit = alert.circles?.some(circle => {
      try { return turf.booleanIntersects(line, turf.circle([circle.longitude, circle.latitude], circle.radiusKm, { units: "kilometers" })); }
      catch { return false; }
    });
    return polygonHit || circleHit;
  });
  return {
    ...route,
    hazardCheck: "checked",
    warnings: hits.length
      ? hits.map(alert => `WARNING: route intersects the available area for “${alert.title}”. Follow authority closures and seek an approved alternative.`)
      : ["No intersection detected with currently available active severe/extreme NDMA SACHET alert geometry"],
  };
}

function chooseSearchRadius(caseRecord: CaseRecord, sites: SiteRecord[], plans: Plan[], alerts: DisasterAlert[]) {
  for (const radius of RELOCATION_CONFIG.site.searchRadiiKm) {
    const available = sites.map(site => evaluateFieldSite(caseRecord, site, plans, alerts, radius))
      .filter(site => site.eligible).reduce((sum, site) => sum + (site.availableCapacity ?? 0), 0);
    if (available >= caseRecord.population) return radius;
  }
  return RELOCATION_CONFIG.site.searchRadiiKm.at(-1)!;
}

export async function createRelocationPlan(input: {
  caseRecord: CaseRecord;
  sites: SiteRecord[];
  plans: Plan[];
  facilities: NearbyFacility[];
  alerts: SourceResult<DisasterAlert[]>;
  routeProvider?: RouteProvider;
}): Promise<RelocationPlan> {
  const { caseRecord, sites, plans, facilities, alerts } = input;
  const routeProvider = input.routeProvider ?? getRoadRoute;
  const report = risk(caseRecord);
  const decision = relocationDecision(report.score, caseRecord);
  const searchRadiusKm = chooseSearchRadius(caseRecord, sites, plans, alerts.data);
  const fieldCandidates = sites.map(site => evaluateFieldSite(caseRecord, site, plans, alerts.data, searchRadiusKm));
  const discoveredCandidates = facilities.map(facility => evaluateOsmCandidate(facility, searchRadiusKm));
  const candidates = [...fieldCandidates, ...discoveredCandidates]
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.suitabilityScore ?? -1) - (a.suitabilityScore ?? -1) || a.straightLineDistanceKm - b.straightLineDistanceKm);
  const allocations = decision.priority === "NONE" ? [] : allocatePopulation(caseRecord.population, candidates);
  const assignments: RelocationAssignment[] = await Promise.all(allocations.map(async assignment => {
    const site = candidates.find(candidate => candidate.id === assignment.siteId)!;
    try {
      const route = routeHazardCheck(await routeProvider(caseRecord, site), alerts);
      return { ...assignment, route };
    } catch (error) {
      return { ...assignment, routeError: error instanceof Error ? error.message : "Route currently unavailable" };
    }
  }));
  const allocatedPopulation = assignments.reduce((sum, assignment) => sum + assignment.allocatedPopulation, 0);
  const unallocatedPopulation = Math.max(0, caseRecord.population - allocatedPopulation);
  const warnings: string[] = [];
  if (unallocatedPopulation > 0 && decision.priority !== "NONE") warnings.push(`Additional verified safe-site capacity is required for ${unallocatedPopulation} people`);
  if (!assignments.length && decision.priority !== "NONE") warnings.push("No field-verified eligible destination with available capacity was found within the search radius");
  if (assignments.some(assignment => !assignment.route)) warnings.push("One or more road routes are currently unavailable; no straight-line route was substituted");
  if (alerts.status === "unavailable") warnings.push("Official NDMA route-area screening is currently unavailable");
  return {
    habitation: {
      id: caseRecord.id, name: caseRecord.name, latitude: caseRecord.latitude, longitude: caseRecord.longitude,
      population: caseRecord.population, riskScore: report.score, riskLevel: report.category,
      dominantHazards: dominantHazards(caseRecord), evidence: caseRecord.evidence,
    },
    decision, searchRadiusKm, candidates, assignments, allocatedPopulation, unallocatedPopulation, warnings,
    dataSources: [
      "Habitation, population and risk inputs: saved workspace field assessment",
      "Capacity and site safety: saved field-verified site assessments",
      ...(facilities.length ? ["Additional unverified facility candidates: OpenStreetMap"] : []),
      `Hazard-area screening: NDMA SACHET (${alerts.status})`,
      ...new Set(assignments.flatMap(assignment => assignment.route ? [`Road routing: ${assignment.route.provider}`] : [])),
    ],
    generatedAt: new Date().toISOString(),
  };
}
