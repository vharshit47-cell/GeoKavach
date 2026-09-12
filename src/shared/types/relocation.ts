import type { LineString } from "geojson";

export type RelocationPriority = "NONE" | "MONITOR" | "PREPARE" | "IMMEDIATE";

export type RelocationDecision = {
  priority: RelocationPriority;
  recommendation: string;
  reasons: string[];
};

export type SuitabilityComponents = {
  safety?: number;
  capacity?: number;
  distance?: number;
  accessibility?: number;
  services?: number;
};

export type SafeSiteCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: "Saved field assessment" | "OpenStreetMap";
  sourceUrl?: string;
  fieldVerified: boolean;
  verifiedCapacity: boolean;
  maximumCapacity?: number;
  currentOccupancy?: number;
  availableCapacity?: number;
  straightLineDistanceKm: number;
  safetyScore?: number;
  suitabilityScore?: number;
  suitabilityComponents: SuitabilityComponents;
  confidence: "supported" | "reduced" | "insufficient";
  eligible: boolean;
  reasons: string[];
  warnings: string[];
};

export type RelocationRouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
};

export type RelocationRoute = {
  geometry: LineString;
  distanceMeters: number;
  durationSeconds: number;
  steps: RelocationRouteStep[];
  provider: "OpenRouteService" | "OSRM";
  hazardCheck: "checked" | "not-available";
  warnings: string[];
};

export type RelocationAssignment = {
  siteId: string;
  allocatedPopulation: number;
  route?: RelocationRoute;
  routeError?: string;
};

export type RelocationPlan = {
  habitation: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    population: number;
    riskScore: number;
    riskLevel: string;
    dominantHazards: string[];
    district?: string;
    state?: string;
    evidence: string;
  };
  decision: RelocationDecision;
  searchRadiusKm: number;
  candidates: SafeSiteCandidate[];
  assignments: RelocationAssignment[];
  allocatedPopulation: number;
  unallocatedPopulation: number;
  warnings: string[];
  dataSources: string[];
  generatedAt: string;
};
