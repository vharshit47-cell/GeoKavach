import { boundedNumber, liveRoute, locationInput } from "@/backend/controllers/live-api";
import { getGroundwater } from "@/backend/providers/groundwater";
export const runtime = "nodejs";
export const GET = liveRoute(async params => { const location = locationInput(params)!; return getGroundwater(location.latitude, location.longitude, boundedNumber(params, "radius", 1, 100, 25)); }, 20);
