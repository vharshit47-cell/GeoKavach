/** Opt-in network smoke check: npx tsx tests/provider-smoke.ts. No fixtures or fallback events. */
import { getAlerts } from "../src/backend/providers/ndma";
import { getWeather } from "../src/backend/providers/weather";
import { getEarthquakes } from "../src/backend/providers/earthquake";
import { getNews } from "../src/backend/providers/gdelt";
import { getNearbyFacilities } from "../src/backend/providers/osm";
import { getBoundaries } from "../src/backend/providers/boundaries";
import { getGroundwater } from "../src/backend/providers/groundwater";
import { searchLocations } from "../src/backend/providers/geocoding";

async function main() {
  if (process.argv.includes("--changed")) {
    const [alerts, facilities] = await Promise.all([getAlerts({ latitude: 26.85, longitude: 80.95, state: "Uttar Pradesh", district: "Lucknow" }), getNearbyFacilities(26.85, 80.95, 5)]);
    console.log(JSON.stringify({ source: alerts.source, status: alerts.status, count: alerts.data.length, matched: alerts.data.filter(item => item.locationMatch === "polygon").length, polygons: alerts.data.filter(item => item.polygons?.length).length, bytes: JSON.stringify(alerts).length }));
    console.log(JSON.stringify({ source: facilities.source, status: facilities.status, error: facilities.error, count: facilities.data.length, capacityKnown: facilities.data.some(item => item.capacity !== null) }));
    return;
  }
  const providers = await Promise.allSettled([
    getAlerts({ latitude: 26.85, longitude: 80.95, state: "Uttar Pradesh", district: "Lucknow" }),
    getEarthquakes(), getNews({ state: "Uttar Pradesh" }), getNearbyFacilities(26.85, 80.95, 5),
    getBoundaries("ADM1"), getBoundaries("ADM2", "Uttar Pradesh"), getGroundwater(26.85, 80.95), searchLocations("Lucknow"),
  ]);
  providers.forEach((result, index) => {
    if (result.status === "rejected") return console.log(JSON.stringify({ index, status: "rejected" }));
    const { source, status, error, data } = result.value;
    console.log(JSON.stringify({ source, status, error, count: Array.isArray(data) ? data.length : data && "names" in data ? data.names.length : data && "stations" in data ? data.stations.length : undefined }));
  });
  const regions: Array<[string, number, number]> = [["Uttarakhand", 30.32, 78.03], ["Delhi", 28.61, 77.21], ["Uttar Pradesh", 26.85, 80.95], ["Assam", 26.14, 91.74], ["Maharashtra", 19.08, 72.88], ["Kerala", 8.52, 76.94], ["Tamil Nadu", 13.08, 80.27], ["Odisha", 20.30, 85.82], ["Himachal Pradesh", 31.10, 77.17]];
  for (const [region, lat, lon] of regions) {
    const result = await getWeather(lat, lon);
    console.log(JSON.stringify({ source: result.source, region, status: result.status, error: result.error, currentTime: result.data?.time, temperatureC: result.data?.temperatureC }));
  }
}
main().catch(() => { console.error("Provider smoke check failed"); process.exitCode = 1; });
