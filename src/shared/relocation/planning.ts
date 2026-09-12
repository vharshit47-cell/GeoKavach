import { RELOCATION_CONFIG } from "@/config/relocation";
import type { RelocationAssignment, SafeSiteCandidate, SuitabilityComponents } from "@/types/relocation";

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateSiteSuitability(components: SuitabilityComponents): { totalScore?: number; reasons: string[] } {
  const entries = Object.entries(components).filter((entry): entry is [keyof SuitabilityComponents, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]));
  if (!entries.length) return { reasons: ["Suitability cannot be calculated from the available evidence"] };
  const weights = RELOCATION_CONFIG.suitabilityWeights;
  const weight = entries.reduce((sum, [key]) => sum + weights[key], 0);
  const totalScore = Math.round(entries.reduce((sum, [key, value]) => sum + clamp(value) * weights[key], 0) / weight);
  return {
    totalScore,
    reasons: entries.map(([key, value]) => `${key.charAt(0).toUpperCase()}${key.slice(1)} component ${Math.round(value)}/100`),
  };
}

export function allocatePopulation(population: number, candidates: SafeSiteCandidate[]): Omit<RelocationAssignment, "route" | "routeError">[] {
  let remaining = population;
  const assignments: Omit<RelocationAssignment, "route" | "routeError">[] = [];
  for (const candidate of candidates.filter(item => item.eligible && item.availableCapacity && item.availableCapacity > 0)) {
    if (remaining <= 0 || assignments.length >= RELOCATION_CONFIG.site.routeShortlist) break;
    const allocatedPopulation = Math.min(remaining, candidate.availableCapacity!);
    assignments.push({ siteId: candidate.id, allocatedPopulation });
    remaining -= allocatedPopulation;
  }
  return assignments;
}
