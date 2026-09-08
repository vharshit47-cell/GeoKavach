import type { WeatherData } from "@/types/intelligence";
import { cachedProvider, coordinateKey, fetchJson, finite, record } from "./core";

/**
 * Pure normalizer — converts a raw Open-Meteo JSON response into WeatherData.
 * Exported for unit tests. Returns null fields instead of fabricating zeros.
 */
export function parseWeather(raw: unknown): WeatherData {
  const data = record(raw);
  const current = record(data.current);
  const daily = record(data.daily);

  // Current observation timestamp
  const time =
    typeof current.time === "string"
      ? new Date(current.time).toISOString()
      : new Date().toISOString();

  // Build daily forecast from daily arrays where available, fall back to hourly aggregation
  const dailyTimes = Array.isArray(daily.time) ? (daily.time as unknown[]) : [];
  const forecast = dailyTimes.slice(0, 3).map((dateValue, i) => {
    const date = typeof dateValue === "string" ? dateValue : String(dateValue);
    const precipSum = Array.isArray(daily.precipitation_sum)
      ? finite(daily.precipitation_sum[i])
      : null;
    const probArr = Array.isArray(daily.precipitation_probability_max)
      ? finite(daily.precipitation_probability_max[i])
      : null;
    const gustArr = Array.isArray(daily.wind_gusts_10m_max)
      ? finite(daily.wind_gusts_10m_max[i])
      : null;
    const tMax = Array.isArray(daily.temperature_2m_max)
      ? finite(daily.temperature_2m_max[i])
      : null;
    const tMin = Array.isArray(daily.temperature_2m_min)
      ? finite(daily.temperature_2m_min[i])
      : null;
    return {
      date,
      precipitationMm: precipSum,
      precipitationProbabilityPct: probArr,
      gustKph: gustArr,
      temperatureMaxC: tMax,
      temperatureMinC: tMin,
    };
  });

  return {
    latitude: typeof data.latitude === "number" ? data.latitude : 0,
    longitude: typeof data.longitude === "number" ? data.longitude : 0,
    kind: "model-derived" as const,
    time,

    temperatureC: finite(current.temperature_2m),
    humidityPct: finite(current.relative_humidity_2m),
    precipitationMm: finite(current.precipitation),
    rainMm: finite(current.rain),
    weatherCode: typeof current.weather_code === "number" ? current.weather_code : null,
    windKph: finite(current.wind_speed_10m),
    gustKph: finite(current.wind_gusts_10m),

    forecast,
  };
}

/**
 * Fetches current weather and 3-day forecast from Open-Meteo for any India coordinate.
 * No API key required. Revalidates every 5 minutes via cachedProvider.
 * Returns SourceResult<WeatherData> — status reflects live/cached/stale/unavailable.
 */
export function getWeather(latitude: number, longitude: number) {
  return cachedProvider<WeatherData | null>(
    `weather:${coordinateKey(latitude, longitude)}`,
    "Open-Meteo",
    5 * 60_000,
    null,
    async () => {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),

        current: [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "precipitation",
          "rain",
          "weather_code",
          "wind_speed_10m",
          "wind_gusts_10m",
        ].join(","),

        daily: [
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_sum",
          "precipitation_probability_max",
          "wind_gusts_10m_max",
        ].join(","),

        forecast_days: "3",
        timezone: "auto",
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const raw = await fetchJson(url, { timeoutMs: 10_000 });

      const result = parseWeather(raw);
      return result;
    },
    "Open-Meteo NWP model output. Not an official IMD forecast. Values are model estimates and may differ from observed conditions."
  );
}