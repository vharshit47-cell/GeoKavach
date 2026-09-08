export type RiskCategory = "SAFE" | "MODERATE" | "HIGH" | "RED";
export type HazardType = "LANDSLIDE" | "FLOOD" | "CLOUDBURST";
export type HazardZoneCollection = {
  type: "FeatureCollection";
  features: Array<{ type: "Feature"; properties: { hazard: HazardType; label: string }; geometry: { type: "Polygon"; coordinates: number[][][] } }>;
};
export type VulnerabilityLevel = "LOW" | "MODERATE" | "HIGH";
export type PriorityCategory = "MONITOR" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DataConfidence = "LOW" | "MEDIUM" | "HIGH";

export type RiskBreakdown = {
  landslide: number;
  flood: number;
  cloudburst: number;
  vulnerability: number;
  disaster_history: number;
  total: number;
};

export type DemoProvenance = {
  provenance: "demo";
  source: "Demo Dataset";
  isOfficial: false;
};

export type Habitation = DemoProvenance & {
  id: number;
  name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  population: number;
  landslide_risk: number;
  flood_risk: number;
  cloudburst_risk: number;
  elderly_pct: number;
  children_pct: number;
  road_access: number;
  past_disasters: number;
  primary_hazard: HazardType;
  hazard_score: number;
  vulnerability_score: number;
  vulnerability_level: VulnerabilityLevel;
  risk_score: number;
  risk_category: RiskCategory;
  priority_score: number;
  priority_category: PriorityCategory;
  recommended_action: string;
  risk_breakdown: RiskBreakdown;
  data_confidence: DataConfidence;
  last_updated: string;
};

export type SafeSite = DemoProvenance & {
  state: string;
  capacity_status: "estimated-demo";
  id: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  land_hectares: number;
  hazard_score: number;
  safety_score: number;
  water_score: number;
  road_score: number;
  healthcare_score: number;
  education_score: number;
  infrastructure_factor: number;
  capacity: number;
  allocated_population: number;
  remaining_capacity: number;
  suitability_score: number;
  data_confidence: DataConfidence;
  last_updated: string;
};

export type RelocationRecommendation = DemoProvenance & {
  capacity_status: "estimated-demo";
  route_status: "straight-line-not-road-route";
  habitation_id: number;
  habitation_name: string;
  population: number;
  risk_score: number;
  risk_category: RiskCategory;
  priority_score: number;
  priority_category: PriorityCategory;
  origin_latitude: number;
  origin_longitude: number;
  site_id: number;
  site_name: string;
  site_latitude: number;
  site_longitude: number;
  distance_km: number;
  suitability_score: number;
  safety_score: number;
  site_capacity: number;
  remaining_capacity_after: number;
  matching_score: number;
};

export type DashboardSummary = DemoProvenance & {
  total_habitations: number;
  hazard_zones: number;
  red_zones: number;
  high_risk: number;
  population_at_risk: number;
  immediate_relocation_population: number;
  safe_sites: number;
  total_available_capacity: number;
  data_confidence: DataConfidence;
  last_updated: string;
};

export type SimulationInput = {
  habitation_id: number;
  rainfall: number;
  road_access: number;
  population_vulnerability: number;
  hazard_intensity?: number;
};

export type SimulationResult = DemoProvenance & {
  habitation_id: number;
  habitation_name: string;
  current_risk: number;
  current_category: RiskCategory;
  projected_risk: number;
  projected_category: RiskCategory;
  modeled_change: number;
  recommendation: string;
  assumptions: string[];
};
