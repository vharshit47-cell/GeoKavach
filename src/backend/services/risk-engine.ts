import { MODEL_CONFIG, RISK_BANDS } from "@/config/risk";
import type { Habitation, HazardType, PriorityCategory, RiskBreakdown, RiskCategory, VulnerabilityLevel } from "@/types/disaster";

type RiskInputs = Pick<Habitation, "landslide_risk" | "flood_risk" | "cloudburst_risk" | "elderly_pct" | "children_pct" | "road_access" | "past_disasters">;

export const clampScore = (value: number) => Math.max(0, Math.min(100, value));
export const roundScore = (value: number) => Math.round(clampScore(value));

export function normalizeDisasterHistory(pastDisasters: number) {
  return clampScore((pastDisasters / MODEL_CONFIG.normalization.disasterHistoryReference) * 100);
}

export function calculateHazardScore(input: RiskInputs) {
  const weights = MODEL_CONFIG.hazardWeights;
  return clampScore(
    input.landslide_risk * weights.landslide +
      input.flood_risk * weights.flood +
      input.cloudburst_risk * weights.cloudburst,
  );
}

export function calculateVulnerabilityScore(input: RiskInputs) {
  const weights = MODEL_CONFIG.vulnerabilityWeights;
  const elderly = clampScore((input.elderly_pct / MODEL_CONFIG.normalization.elderlyPctReference) * 100);
  const children = clampScore((input.children_pct / MODEL_CONFIG.normalization.childrenPctReference) * 100);
  const accessibility = clampScore(100 - input.road_access);
  return clampScore(elderly * weights.elderly + children * weights.children + accessibility * weights.accessibility);
}

export function calculateRisk(input: RiskInputs): { hazard: number; vulnerability: number; score: number; breakdown: RiskBreakdown } {
  const hazard = calculateHazardScore(input);
  const vulnerability = calculateVulnerabilityScore(input);
  const history = normalizeDisasterHistory(input.past_disasters);
  const hazardWeights = MODEL_CONFIG.hazardWeights;
  const finalWeights = MODEL_CONFIG.finalRiskWeights;
  const breakdown = {
    landslide: input.landslide_risk * hazardWeights.landslide * finalWeights.hazard,
    flood: input.flood_risk * hazardWeights.flood * finalWeights.hazard,
    cloudburst: input.cloudburst_risk * hazardWeights.cloudburst * finalWeights.hazard,
    vulnerability: vulnerability * finalWeights.vulnerability,
    disaster_history: history * finalWeights.disasterHistory,
    total: 0,
  };
  breakdown.total = breakdown.landslide + breakdown.flood + breakdown.cloudburst + breakdown.vulnerability + breakdown.disaster_history;

  return {
    hazard: roundScore(hazard),
    vulnerability: roundScore(vulnerability),
    score: roundScore(breakdown.total),
    breakdown: {
      landslide: Math.round(breakdown.landslide),
      flood: Math.round(breakdown.flood),
      cloudburst: Math.round(breakdown.cloudburst),
      vulnerability: Math.round(breakdown.vulnerability),
      disaster_history: Math.round(breakdown.disaster_history),
      total: roundScore(breakdown.total),
    },
  };
}

export function riskCategory(score: number): RiskCategory {
  return RISK_BANDS.find(band => score <= band.max)?.category ?? "RED";
}

export function vulnerabilityLevel(score: number): VulnerabilityLevel {
  if (score < 40) return "LOW";
  if (score < 65) return "MODERATE";
  return "HIGH";
}

export function primaryHazard(input: RiskInputs): HazardType {
  const hazards: Array<[HazardType, number]> = [
    ["LANDSLIDE", input.landslide_risk],
    ["FLOOD", input.flood_risk],
    ["CLOUDBURST", input.cloudburst_risk],
  ];
  return hazards.sort((a, b) => b[1] - a[1])[0][0];
}

export function calculatePriority(riskScore: number, vulnerabilityScore: number, pastDisasters: number) {
  const weights = MODEL_CONFIG.priorityWeights;
  return roundScore(
    riskScore * weights.risk +
      vulnerabilityScore * weights.vulnerability +
      normalizeDisasterHistory(pastDisasters) * weights.disasterHistory,
  );
}

export function priorityCategory(score: number): PriorityCategory {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "MONITOR";
}

export function recommendedAction(risk: RiskCategory, priority: PriorityCategory) {
  if (priority === "CRITICAL") return "Urgent authority review";
  if (risk === "RED") return "Prepare Relocation";
  if (risk === "HIGH") return "Mitigate & Monitor";
  if (risk === "MODERATE") return "Strengthen Preparedness";
  return "Routine Monitoring";
}
