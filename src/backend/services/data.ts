import { MODEL_CONFIG } from "@/config/risk";
import type { DataConfidence, Habitation, SafeSite } from "@/types/disaster";
import { numberValue, readCsv } from "./csv";
import { calculatePriority, calculateRisk, primaryHazard, priorityCategory, recommendedAction, riskCategory, vulnerabilityLevel } from "./risk-engine";
import { calculateCapacity, calculateSafetyScore, calculateSuitability, type SiteInputs } from "./site-engine";

function confidence(value: string): DataConfidence {
  return value === "HIGH" || value === "LOW" ? value : "MEDIUM";
}

let habitationCache: Habitation[] | undefined;
let siteCache: SafeSite[] | undefined;

export function getHabitations(): Habitation[] {
  if (habitationCache) return habitationCache;
  habitationCache = readCsv("habitations.csv").map((row) => {
    const input = {
      landslide_risk: numberValue(row, "landslide_risk"),
      flood_risk: numberValue(row, "flood_risk"),
      cloudburst_risk: numberValue(row, "cloudburst_risk"),
      elderly_pct: numberValue(row, "elderly_pct"),
      children_pct: numberValue(row, "children_pct"),
      road_access: numberValue(row, "road_access"),
      past_disasters: numberValue(row, "past_disasters"),
    };
    const analysis = calculateRisk(input);
    const category = riskCategory(analysis.score);
    const priorityScore = calculatePriority(analysis.score, analysis.vulnerability, input.past_disasters);
    const priority = priorityCategory(priorityScore);
    return {
      provenance: "demo",
      source: "Demo Dataset",
      isOfficial: false,
      id: numberValue(row, "id"),
      name: row.name,
      district: row.district,
      state: row.state,
      latitude: numberValue(row, "lat"),
      longitude: numberValue(row, "lon"),
      population: numberValue(row, "population"),
      ...input,
      primary_hazard: primaryHazard(input),
      hazard_score: analysis.hazard,
      vulnerability_score: analysis.vulnerability,
      vulnerability_level: vulnerabilityLevel(analysis.vulnerability),
      risk_score: analysis.score,
      risk_category: category,
      priority_score: priorityScore,
      priority_category: priority,
      recommended_action: recommendedAction(category, priority),
      risk_breakdown: analysis.breakdown,
      data_confidence: confidence(row.data_confidence),
      last_updated: MODEL_CONFIG.lastUpdated,
    };
  });
  return habitationCache;
}

export function getBaseSafeSites(): SafeSite[] {
  if (siteCache) return siteCache;
  siteCache = readCsv("relocation_sites.csv").map((row) => {
    const input: SiteInputs = {
      land_hectares: numberValue(row, "land_hectares"),
      hazard_score: numberValue(row, "hazard_score"),
      water_score: numberValue(row, "water_score"),
      road_score: numberValue(row, "road_score"),
      healthcare_score: numberValue(row, "healthcare_score"),
      education_score: numberValue(row, "education_score"),
    };
    const capacity = calculateCapacity(input);
    return {
      provenance: "demo",
      source: "Demo Dataset",
      isOfficial: false,
      capacity_status: "estimated-demo",
      state: row.state || "Uttarakhand",
      id: numberValue(row, "id"),
      name: row.name,
      district: row.district,
      latitude: numberValue(row, "lat"),
      longitude: numberValue(row, "lon"),
      ...input,
      safety_score: calculateSafetyScore(input.hazard_score),
      infrastructure_factor: capacity.infrastructureFactor,
      capacity: capacity.capacity,
      allocated_population: 0,
      remaining_capacity: capacity.capacity,
      suitability_score: calculateSuitability(input),
      data_confidence: confidence(row.data_confidence),
      last_updated: MODEL_CONFIG.lastUpdated,
    };
  });
  return siteCache;
}
