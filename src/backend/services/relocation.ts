import { MODEL_CONFIG } from "@/config/risk";
import type { Habitation, RelocationRecommendation, SafeSite } from "@/types/disaster";
import { getBaseSafeSites, getHabitations } from "./data";
import { rankSafeSites } from "@/shared/config/assessment";

export function buildRelocationPlan(): RelocationRecommendation[] {
  const habitations = getHabitations()
    .filter((item) => item.risk_category === "RED")
    .sort((a, b) => b.priority_score - a.priority_score || b.risk_score - a.risk_score);
  const sites = getBaseSafeSites();
  const remaining = new Map(sites.map((site) => [site.id, site.capacity]));
  const plan: RelocationRecommendation[] = [];

  for (const habitation of habitations) {
    const candidates = rankSafeSites(habitation, sites.map(site => ({ ...site, remaining_capacity: remaining.get(site.id) ?? 0 })));
    const winner = candidates[0];
    if (!winner) continue;
    const remainingAfter = (remaining.get(winner.site.id) ?? 0) - habitation.population;
    remaining.set(winner.site.id, remainingAfter);
    plan.push({
      provenance: "demo",
      source: "Demo Dataset",
      isOfficial: false,
      capacity_status: "estimated-demo",
      route_status: "straight-line-not-road-route",
      habitation_id: habitation.id,
      habitation_name: habitation.name,
      population: habitation.population,
      risk_score: habitation.risk_score,
      risk_category: habitation.risk_category,
      priority_score: habitation.priority_score,
      priority_category: habitation.priority_category,
      origin_latitude: habitation.latitude,
      origin_longitude: habitation.longitude,
      site_id: winner.site.id,
      site_name: winner.site.name,
      site_latitude: winner.site.latitude,
      site_longitude: winner.site.longitude,
      distance_km: Number(winner.distance.toFixed(1)),
      suitability_score: winner.site.suitability_score,
      safety_score: winner.site.safety_score,
      site_capacity: winner.site.capacity,
      remaining_capacity_after: remainingAfter,
      matching_score: Math.round(winner.score),
    });
  }
  return plan;
}

export function getSafeSitesWithAllocations() {
  const sites = getBaseSafeSites();
  const plan = buildRelocationPlan();
  return sites.map((site) => {
    const allocations = plan.filter((item) => item.site_id === site.id);
    const allocatedPopulation = allocations.reduce((sum, item) => sum + item.population, 0);
    return { ...site, allocated_population: allocatedPopulation, remaining_capacity: site.capacity - allocatedPopulation };
  });
}
