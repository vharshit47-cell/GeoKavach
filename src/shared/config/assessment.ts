import type { Habitation, SafeSite, RelocationRecommendation } from "@/types/disaster";
import { MODEL_CONFIG } from "./risk";
import { haversineDistanceKm } from "@/backend/services/distance";

export const validCoordinates = (point: { latitude: number; longitude: number }) =>
  Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;

export function siteStatus(site: SafeSite, population = 1) {
  if (!validCoordinates(site) || site.hazard_score > MODEL_CONFIG.relocation.permittedHazardScore || site.water_score < 40 || site.road_score < 40) return "Not Suitable";
  return site.remaining_capacity < population ? "Limited Capacity" : "Suitable";
}

// Shared by the allocation engine and the interactive, single-habitation planner.
export function rankSafeSites(habitation: Habitation, sites: SafeSite[]) {
  if (!validCoordinates(habitation) || habitation.population <= 0) return [];
  return sites.filter(site => siteStatus(site, habitation.population) === "Suitable").map(site => {
    const distance = haversineDistanceKm(habitation.latitude, habitation.longitude, site.latitude, site.longitude);
    const distanceScore = Math.max(0, 100 - distance / MODEL_CONFIG.normalization.distanceKmReference * 100);
    const capacityScore = Math.min(100, site.remaining_capacity / habitation.population * 40) * .4 + Math.min(100, site.remaining_capacity / site.capacity * 100) * .6;
    const w = MODEL_CONFIG.matchingWeights;
    const score = site.suitability_score * w.suitability + site.safety_score * w.safety + capacityScore * w.capacity + distanceScore * w.distance;
    return { site, distance, score };
  }).sort((a, b) => b.score - a.score || a.distance - b.distance || a.site.id - b.site.id);
}

export function availableForHabitation(id: number, sites: SafeSite[], plan: RelocationRecommendation[]) {
  const previous = plan.find(p => p.habitation_id === id);
  return sites.map(site => ({ ...site, remaining_capacity: site.remaining_capacity + (previous?.site_id === site.id ? previous.population : 0) }));
}

export function recommendationForHabitation(h: Habitation, sites: SafeSite[], plan: RelocationRecommendation[]): RelocationRecommendation | null {
  const winner = rankSafeSites(h, availableForHabitation(h.id, sites, plan))[0];
  if (!winner) return null;
  return {
    provenance: "demo", source: "Demo Dataset", isOfficial: false,
    capacity_status: "estimated-demo", route_status: "straight-line-not-road-route",
    habitation_id: h.id, habitation_name: h.name, population: h.population,
    risk_score: h.risk_score, risk_category: h.risk_category,
    priority_score: h.priority_score, priority_category: h.priority_category,
    origin_latitude: h.latitude, origin_longitude: h.longitude,
    site_id: winner.site.id, site_name: winner.site.name,
    site_latitude: winner.site.latitude, site_longitude: winner.site.longitude,
    distance_km: Number(winner.distance.toFixed(1)), suitability_score: winner.site.suitability_score,
    safety_score: winner.site.safety_score, site_capacity: winner.site.capacity,
    remaining_capacity_after: winner.site.remaining_capacity - h.population, matching_score: Math.round(winner.score),
  };
}
