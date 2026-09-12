import type { RelocationDecision } from "@/types/relocation";
import type { CaseInput } from "@/shared/workflow/model";

export const RELOCATION_CONFIG = {
  riskBands: {
    monitor: 26,
    prepare: 51,
    immediate: 76,
  },
  site: {
    maximumFieldHazard: 1,
    searchRadiiKm: [10, 20, 30],
    routeShortlist: 5,
  },
  suitabilityWeights: {
    safety: 35,
    capacity: 25,
    distance: 20,
    accessibility: 10,
    services: 10,
  },
  routing: {
    profile: "driving-car",
    timeoutMs: 12_000,
  },
} as const;

const hazardLabels: Record<string, string> = {
  flood: "flood",
  landslide: "landslide",
  coastalErosion: "coastal erosion",
  cloudburst: "cloudburst",
};

export function dominantHazards(input: CaseInput): string[] {
  const maximum = Math.max(...Object.values(input.hazards));
  if (maximum <= 0) return [];
  return Object.entries(input.hazards)
    .filter(([, value]) => value === maximum)
    .map(([key]) => hazardLabels[key] ?? key);
}

export function relocationDecision(riskScore: number, input?: CaseInput): RelocationDecision {
  const reasons: string[] = [];
  if (riskScore >= RELOCATION_CONFIG.riskBands.immediate) reasons.push("Critical deterministic risk score");
  else if (riskScore >= RELOCATION_CONFIG.riskBands.prepare) reasons.push("High deterministic risk score");
  else if (riskScore >= RELOCATION_CONFIG.riskBands.monitor) reasons.push("Moderate deterministic risk score");
  else reasons.push("Risk score is below the relocation-monitoring threshold");

  if (input) {
    const hazards = dominantHazards(input);
    if (hazards.length) reasons.push(`Highest recorded exposure: ${hazards.join(" and ")}`);
    if (input.vulnerable > 0) reasons.push(`${input.vulnerable} vulnerable people recorded in the field assessment`);
  }

  if (riskScore >= RELOCATION_CONFIG.riskBands.immediate) return { priority: "IMMEDIATE", recommendation: "Immediate relocation assessment recommended", reasons };
  if (riskScore >= RELOCATION_CONFIG.riskBands.prepare) return { priority: "PREPARE", recommendation: "Prepare a verified relocation plan", reasons };
  if (riskScore >= RELOCATION_CONFIG.riskBands.monitor) return { priority: "MONITOR", recommendation: "Monitor and maintain relocation readiness", reasons };
  return { priority: "NONE", recommendation: "No relocation indicated by the current assessment", reasons };
}
