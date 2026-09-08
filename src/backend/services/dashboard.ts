import { getHazardZones } from "./hazard-zones";
import { getSafeSitesWithAllocations } from "./relocation";
import type { DashboardSummary } from "@/types/disaster";
import { getBaseSafeSites, getHabitations } from "./data";

export function getDashboardSummary(): DashboardSummary {
  const habitations = getHabitations();
  const sites = getSafeSitesWithAllocations();
  return {
    provenance: "demo",
    source: "Demo Dataset",
    isOfficial: false,
    hazard_zones: getHazardZones().features.length,
    total_habitations: habitations.length,
    red_zones: habitations.filter((item) => item.risk_category === "RED").length,
    high_risk: habitations.filter((item) => item.risk_category === "HIGH").length,
    population_at_risk: habitations.filter((item) => item.risk_category === "HIGH" || item.risk_category === "RED").reduce((sum, item) => sum + item.population, 0),
    immediate_relocation_population: habitations.filter((item) => item.priority_category === "CRITICAL").reduce((sum, item) => sum + item.population, 0),
    safe_sites: sites.length,
    total_available_capacity: sites.reduce((sum, site) => sum + site.remaining_capacity, 0),
    data_confidence: "MEDIUM",
    last_updated: habitations[0]?.last_updated ?? "Unavailable",
  };
}
