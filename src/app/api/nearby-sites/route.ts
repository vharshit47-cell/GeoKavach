import { boundedNumber, liveRoute, locationInput } from "@/backend/controllers/live-api";
import { getNearbyFacilities } from "@/backend/providers/osm";
export const runtime = "nodejs";
export const GET = liveRoute(async params => { const location = locationInput(params)!; return getNearbyFacilities(location.latitude, location.longitude, boundedNumber(params, "radius", 1, 30, 10)); }, 20);
