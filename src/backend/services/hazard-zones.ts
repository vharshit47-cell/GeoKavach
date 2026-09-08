import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

// Cached in module scope — read once per server process.
let _hazardZonesCache: FeatureCollection<Geometry> | undefined;

/** Returns the full hazard-zone GeoJSON FeatureCollection (baseline/static data). */
export function getHazardZones(): FeatureCollection<Geometry> {
  if (_hazardZonesCache) return _hazardZonesCache;
  const filePath = path.join(
    process.cwd(),
    "src/backend/data/hazard_zones.geojson"
  );
  const fileContent = fs.readFileSync(filePath, "utf-8");
  _hazardZonesCache = JSON.parse(fileContent) as FeatureCollection<Geometry>;
  return _hazardZonesCache;
}

export function getHazardAtLocation(
  latitude: number,
  longitude: number
) {
  const geojson = getHazardZones();

  const point = turf.point([
    longitude,
    latitude,
  ]);

  for (const feature of geojson.features) {
    try {
      const geometryType = feature?.geometry?.type;

      if (
        geometryType !== "Polygon" &&
        geometryType !== "MultiPolygon"
      ) {
        continue;
      }

      const isInside = turf.booleanPointInPolygon(
        point,
        feature as Feature<Polygon | MultiPolygon>
      );

      if (isInside) {
        return {
          found: true,
          properties: feature.properties ?? {},
        };
      }
    } catch (error) {
      console.error(
        "Error checking hazard polygon:",
        error
      );
    }
  }

  return {
    found: false,
    properties: null,
  };
}