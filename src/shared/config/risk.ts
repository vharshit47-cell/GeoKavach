import type { PriorityCategory, RiskCategory } from "@/types/disaster";

export const MODEL_CONFIG = {
  hazardWeights: { landslide: 0.45, flood: 0.35, cloudburst: 0.2 },
  vulnerabilityWeights: { elderly: 0.35, children: 0.35, accessibility: 0.3 },
  finalRiskWeights: { hazard: 0.55, vulnerability: 0.3, disasterHistory: 0.15 },
  priorityWeights: { risk: 0.5, vulnerability: 0.3, disasterHistory: 0.2 },
  suitabilityWeights: { safety: 0.3, land: 0.2, water: 0.15, road: 0.15, healthcare: 0.1, education: 0.1 },
  matchingWeights: { suitability: 0.4, safety: 0.25, capacity: 0.2, distance: 0.15 },
  normalization: {
    elderlyPctReference: 25,
    childrenPctReference: 35,
    disasterHistoryReference: 5,
    landHectaresReference: 14,
    distanceKmReference: 70,
  },
  capacity: {
    squareMetresPerHectare: 10_000,
    requiredAreaPerPerson: 30,
    infrastructureBaseFactor: 0.5,
    infrastructureScoreFactor: 0.3,
    roundingIncrement: 50,
  },
  relocation: { permittedHazardScore: 30 },
  // Fixed demonstration dataset release, never a live refresh timestamp.
  lastUpdated: "2026-09-05T04:00:00.000Z",
} as const;

export const RISK_STYLES: Record<RiskCategory, { label: string; color: string; soft: string }> = {
  SAFE: { label: "Safe", color: "#45df96", soft: "#123e28" },
  MODERATE: { label: "Moderate", color: "#f0cf4e", soft: "#383418" },
  HIGH: { label: "High", color: "#f3a047", soft: "#422d1b" },
  RED: { label: "Critical", color: "#f26067", soft: "#44242a" },
};

export const PRIORITY_STYLES: Record<PriorityCategory, { label: string; color: string; soft: string }> = {
  MONITOR: { label: "Monitor", color: "#55717b", soft: "#edf2f3" },
  MEDIUM: { label: "Medium", color: "#b27c18", soft: "#fff6df" },
  HIGH: { label: "High", color: "#d4602b", soft: "#422d1b" },
  CRITICAL: { label: "Critical", color: "#bd3340", soft: "#fde9eb" },
};

export const RISK_BANDS: { category: RiskCategory; min: number; max: number; description: string }[] = [
 {category:"SAFE",min:0,max:25,description:"Minimal modeled risk. Routine monitoring."},
 {category:"MODERATE",min:26,max:50,description:"Monitoring and preparedness recommended."},
 {category:"HIGH",min:51,max:75,description:"Significant risk. Relocation planning recommended."},
 {category:"RED",min:76,max:100,description:"Very high risk. Immediate assessment priority."},
];
