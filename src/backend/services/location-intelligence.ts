import type { LiveRisk, LocationIntelligence, LocationPoint, SourceResult } from "@/types/intelligence";
import { LIVE_RISK_CONFIG } from "@/config/live-risk";
import { getAlerts } from "@/backend/providers/ndma";
import { getWeather } from "@/backend/providers/weather";
import { getEarthquakes } from "@/backend/providers/earthquake";
import { getNews } from "@/backend/providers/gdelt";
import { getNearbyFacilities } from "@/backend/providers/osm";
import { getGroundwater } from "@/backend/providers/groundwater";
import { unavailable } from "@/backend/providers/core";

export function calculateLiveRisk(input: Pick<LocationIntelligence, "alerts" | "weather" | "earthquakes">, now = Date.now()): LiveRisk {
  const cfg = LIVE_RISK_CONFIG;
  const factors: LiveRisk["factors"] = [];
  const unavailableSources = [input.alerts, input.weather, input.earthquakes].filter(result => !["live", "cached"].includes(result.status)).map(result => result.source);
  const precise = input.alerts.status === "live" || input.alerts.status === "cached"
    ? input.alerts.data.filter(alert => alert.active && !!alert.endTime && Date.parse(alert.endTime) > now && ["polygon", "district"].includes(alert.locationMatch)) : [];
  const regional = input.alerts.status === "live" || input.alerts.status === "cached"
    ? input.alerts.data.filter(alert => alert.active && !!alert.endTime && Date.parse(alert.endTime) > now && alert.locationMatch === "state") : [];
  const official = precise.sort((a, b) => cfg.officialPoints[b.severity] - cfg.officialPoints[a.severity])[0];
  const advisory = regional.sort((a, b) => cfg.officialPoints[b.severity] - cfg.officialPoints[a.severity])[0];
  let officialPoints = official ? cfg.officialPoints[official.severity] : advisory ? Math.min(cfg.regionalAdvisoryCap, cfg.officialPoints[advisory.severity]) : 0;
  if (official || advisory) factors.push({ code: official ? "official-alert" : "regional-advisory", label: official ? "Applicable official warning" : "State-level official advisory", points: officialPoints, source: "NDMA SACHET", kind: "official", detail: official?.title || advisory!.title });
  const indicators: Array<LiveRisk["factors"][number]> = [];
  const weather = ["live", "cached"].includes(input.weather.status) ? input.weather.data : null;
  if (weather && now - Date.parse(weather.time) < 3 * 3600_000) {
    const rain = Math.max(...weather.forecast.slice(0, 2).map(day => day.precipitationMm || 0));
    const rainPoints = rain >= cfg.rainfallScreeningMm.veryHigh ? 35 : rain >= cfg.rainfallScreeningMm.high ? 25 : rain >= cfg.rainfallScreeningMm.elevated ? 15 : 0;
    if (rainPoints) indicators.push({ code: "forecast-rain", label: "Elevated rainfall forecast", points: rainPoints, source: "Open-Meteo", kind: "model-derived", detail: `${rain.toFixed(1)} mm on a UTC forecast day; rainfall alone does not establish local flooding.` });
    const gust = Math.max(weather.gustKph || 0, ...weather.forecast.slice(0, 2).map(day => day.gustKph || 0));
    const windPoints = gust >= cfg.gustScreeningKph.high ? 20 : gust >= cfg.gustScreeningKph.elevated ? 10 : 0;
    if (windPoints) indicators.push({ code: "forecast-wind", label: "Elevated wind-gust forecast", points: windPoints, source: "Open-Meteo", kind: "model-derived", detail: `Forecast gusts up to ${gust.toFixed(0)} km/h; not a cyclone warning.` });
  }
  const earthquakes = ["live", "cached"].includes(input.earthquakes.status) ? input.earthquakes.data : [];
  const quake = earthquakes.filter(item => now - Date.parse(item.time) >= 0 && now - Date.parse(item.time) <= cfg.earthquake.recentHours * 3600_000 && item.distanceKm != null && item.magnitude >= cfg.earthquake.significantMagnitude)
    .map(item => ({ item, points: item.magnitude >= cfg.earthquake.largeMagnitude && item.distanceKm! <= cfg.earthquake.regionalKm ? 30 : item.distanceKm! <= cfg.earthquake.nearKm ? 20 : 0 })).sort((a, b) => b.points - a.points)[0];
  if (quake?.points) indicators.push({ code: "recent-earthquake", label: "Recent regional earthquake", points: quake.points, source: "USGS", kind: "observed", detail: `M${quake.item.magnitude}, ${quake.item.distanceKm!.toFixed(0)} km away. Epicentral distance does not estimate local shaking or predict another earthquake.` });
  const totalRaw = indicators.reduce((sum, item) => sum + item.points, 0);
  const supplemental = Math.min(cfg.derivedSignalCap, totalRaw);
  // Official warnings dominate; scale secondary evidence into the remaining score range.
  let remaining = Math.round(supplemental * (100 - officialPoints) / 100);
  for (let i = 0; i < indicators.length; i++) {
    const item = indicators[i];
    const points = i === indicators.length - 1 ? remaining : Math.min(remaining, Math.round(item.points / totalRaw * supplemental * (100 - officialPoints) / 100));
    remaining -= points; factors.push({ ...item, points });
  }
  const anySource = [input.alerts, input.weather, input.earthquakes].some(result => ["live", "cached"].includes(result.status));
  const score = anySource ? Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0)) : null;
  const status: LiveRisk["status"] = official && ["severe", "extreme"].includes(official.severity) ? "SEVERE_ALERT" : official && official.severity === "high" ? "WARNING" : (score || 0) > 0 ? "WATCH" : unavailableSources.length ? "UNKNOWN" : "NO_SIGNIFICANT_SIGNAL";
  return { kind: "model-derived", score, status, factors, confidence: unavailableSources.length >= 2 ? "limited" : unavailableSources.length ? "partial" : "supported", unavailableSources,
    explanation: "SurakshaSet triage index (0–100), not a disaster probability, site safety certification or evacuation instruction. The strongest applicable CAP warning is combined with capped weather and recent-earthquake indicators. State-only warnings have reduced weight; news and historical groundwater add zero points.",
    limitations: ["No significant signal does not mean safe. Official feed coverage is bounded and some alerts cannot be located or expiry-verified.", "Thresholds are configurable operational screening rules, not scientifically calibrated risk weights.", "Terrain, soil saturation, building vulnerability, river levels, verified population and road accessibility are unavailable; no values are invented.", "Historical groundwater is contextual only; no validated causal flood/landslide linkage is assumed."],
    recommendedActions: official?.action ? [official.action, "Follow NDMA/state authority directions. For immediate danger call 112."] : ["Check official NDMA/state authority instructions and local conditions.", "Confirm facility access and shelter availability before travelling. For immediate danger call 112."] };
}

function settled<T>(result: PromiseSettledResult<SourceResult<T>>, source: string, empty: T): SourceResult<T> {
  return result.status === "fulfilled" ? result.value : unavailable(source, empty);
}
export async function getLocationIntelligence(location: LocationPoint, radiusKm = 100): Promise<LocationIntelligence> {
  const results = await Promise.allSettled([
    getAlerts(location), getWeather(location.latitude, location.longitude), getEarthquakes(location, Math.max(radiusKm, 300)),
    getNearbyFacilities(location.latitude, location.longitude, 10),
  ]);
  const alerts = settled(results[0], "NDMA SACHET", []);
  const weather = settled(results[1], "Open-Meteo", null);
  const earthquakes = settled(results[2], "USGS", []);
  return { location, radiusKm, updatedAt: new Date().toISOString(), alerts, weather, earthquakes,
    news: unavailable("GDELT", [], "Not included in the four-feature live app"), facilities: settled(results[3], "OpenStreetMap", []), groundwater: unavailable("Historical groundwater dataset", null, "Not included in the live app"),
    risk: calculateLiveRisk({ alerts, weather, earthquakes }) };
}
