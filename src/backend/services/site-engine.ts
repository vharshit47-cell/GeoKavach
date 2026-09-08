import { MODEL_CONFIG } from "@/config/risk";

export type SiteInputs = {
  land_hectares: number;
  hazard_score: number;
  water_score: number;
  road_score: number;
  healthcare_score: number;
  education_score: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateSafetyScore(hazardScore: number) {
  return Math.round(clamp(110 - hazardScore));
}

export function calculateInfrastructureFactor(input: SiteInputs) {
  const average = (input.water_score + input.road_score + input.healthcare_score + input.education_score) / 4;
  return Number((MODEL_CONFIG.capacity.infrastructureBaseFactor + (average / 100) * MODEL_CONFIG.capacity.infrastructureScoreFactor).toFixed(3));
}

export function calculateCapacity(input: SiteInputs) {
  const config = MODEL_CONFIG.capacity;
  const usableArea = input.land_hectares * config.squareMetresPerHectare;
  const grossCapacity = usableArea / config.requiredAreaPerPerson;
  const infrastructureFactor = calculateInfrastructureFactor(input);
  const capacity = Math.round((grossCapacity * infrastructureFactor) / config.roundingIncrement) * config.roundingIncrement;
  return { usableArea, grossCapacity, infrastructureFactor, capacity };
}

export function calculateSuitability(input: SiteInputs) {
  const weights = MODEL_CONFIG.suitabilityWeights;
  const safety = calculateSafetyScore(input.hazard_score);
  const land = clamp((input.land_hectares / MODEL_CONFIG.normalization.landHectaresReference) * 100);
  return Math.round(
    safety * weights.safety +
      land * weights.land +
      input.water_score * weights.water +
      input.road_score * weights.road +
      input.healthcare_score * weights.healthcare +
      input.education_score * weights.education,
  );
}

