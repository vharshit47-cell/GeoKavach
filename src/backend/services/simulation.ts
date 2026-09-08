import type { Habitation, SimulationInput, SimulationResult } from "@/types/disaster";
import { getHabitations } from "./data";
import { clampScore, riskCategory } from "./risk-engine";

export function simulateRisk(input: SimulationInput): SimulationResult | undefined {
  const habitation: Habitation | undefined = getHabitations().find((item) => item.id === input.habitation_id);
  if (!habitation) return undefined;

  const rainfallPressure = clampScore(input.rainfall) * 0.12;
  const hazardPressure = clampScore(input.hazard_intensity ?? input.rainfall) * 0.08;
  const accessibilityPressure = (100 - clampScore(input.road_access)) * 0.07;
  const vulnerabilityPressure = clampScore(input.population_vulnerability) * 0.08;
  const scenarioPressure = rainfallPressure + hazardPressure + accessibilityPressure + vulnerabilityPressure;
  const baselinePressure = 17;
  const projectedRisk = Math.round(clampScore(habitation.risk_score + scenarioPressure - baselinePressure));
  const projectedCategory = riskCategory(projectedRisk);
  const relocate = projectedCategory === "RED" || projectedRisk >= 71;

  return {
    provenance: "demo",
    source: "Demo Dataset",
    isOfficial: false,
    habitation_id: habitation.id,
    habitation_name: habitation.name,
    current_risk: habitation.risk_score,
    current_category: habitation.risk_category,
    projected_risk: projectedRisk,
    projected_category: projectedCategory,
    modeled_change: projectedRisk - habitation.risk_score,
    recommendation: relocate ? "Immediate relocation planning is recommended under this scenario." : "Continue mitigation and preparedness monitoring under this scenario.",
    assumptions: [
      "Rainfall and hazard intensity are modeled as pressure on the current assessed risk.",
      "Lower road accessibility increases population vulnerability.",
      "This is decision-support output based on demonstration data, not an official warning.",
    ],
  };
}
