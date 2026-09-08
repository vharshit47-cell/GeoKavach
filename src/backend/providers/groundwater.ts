import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { GroundwaterData, GroundwaterStation } from "@/types/intelligence";
import { haversineDistanceKm } from "@/lib/server/distance";
import { cachedProvider, coordinateKey } from "./core";

let indexPromise: Promise<GroundwaterData> | undefined;
export function parseCsvRow(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value); return values;
}
async function buildIndex(): Promise<GroundwaterData> {
  const stations = new Map<string, GroundwaterStation>(); let totalRecords = 0; let earliestDate: string | null = null; let latestDate: string | null = null;
  const stream = createReadStream(join(process.cwd(), "src/backend/data/groundwater/groundwater_master.csv"), { encoding: "utf8" });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  let first = true;
  for await (const line of reader) {
    if (first) { first = false; continue; }
    if (!line.trim()) continue;
    totalRecords++;
    const row = parseCsvRow(line); const latitude = Number(row[4]); const longitude = Number(row[5]); const depth = Number(row[7]); const date = row[6];
    if (!row[4] || !row[5] || !row[7] || ![latitude, longitude, depth].every(Number.isFinite) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!latestDate || date > latestDate) latestDate = date;
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}:${row[10]}`;
    if (!stations.has(key) || stations.get(key)!.measurementDate < date) stations.set(key, {
      latitude, longitude, state: row[0], district: row[1], village: row[3], measurementDate: date, depthToWaterMetres: depth, qualityFlags: row[12] || "", sourceFile: row[10],
    });
  }
  return { kind: "historical", stations: [...stations.values()], totalRecords, totalStations: stations.size, earliestDate, latestDate,
    note: "Historical depth to water below ground level, not live flooding or drinking-water quality. Latest available record per coordinate/source; coordinates and source quality flags require verification. No groundwater contribution is applied to the disaster score without a validated local hydrological model." };
}
export function getGroundwater(latitude: number, longitude: number, radiusKm = 25) {
  return cachedProvider<GroundwaterData | null>(`groundwater:${coordinateKey(latitude, longitude)}:${radiusKm}`, "Historical groundwater dataset", 86400_000, null, async () => {
    if (!indexPromise) indexPromise = buildIndex().catch(error => { indexPromise = undefined; throw error; });
    const index = await indexPromise;
    const stations = index.stations.filter(item => Math.abs(item.latitude - latitude) <= radiusKm / 100 && Math.abs(item.longitude - longitude) <= radiusKm / 80)
      .map(item => ({ ...item, distanceKm: haversineDistanceKm(latitude, longitude, item.latitude, item.longitude) }))
      .filter(item => item.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 30);
    return { ...index, stations };
  }).then(result => ({ ...result, status: result.status === "unavailable" ? "unavailable" as const : "historical" as const }));
}
