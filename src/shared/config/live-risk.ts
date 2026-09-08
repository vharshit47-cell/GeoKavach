/** Product triage thresholds, not a scientifically calibrated probability or evacuation rule. */
export const LIVE_RISK_CONFIG = {
  version: "triage-v1",
  officialPoints: { unknown: 0, low: 10, moderate: 30, high: 55, severe: 75, extreme: 90 },
  regionalAdvisoryCap: 25,
  derivedSignalCap: 45,
  rainfallScreeningMm: { elevated: 50, high: 100, veryHigh: 200 },
  gustScreeningKph: { elevated: 50, high: 75 },
  earthquake: { recentHours: 24, significantMagnitude: 5, largeMagnitude: 6, nearKm: 100, regionalKm: 300 },
} as const;
