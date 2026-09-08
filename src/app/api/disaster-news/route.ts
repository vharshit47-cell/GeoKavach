import { boundedNumber, liveRoute, locationInput, placeText } from "@/backend/controllers/live-api";
import { getNews } from "@/backend/providers/gdelt";
export const runtime = "nodejs";
export const GET = liveRoute(async params => { const location = locationInput(params, true); boundedNumber(params, "radius", 10, 1500, 100); return getNews({ ...location, state: placeText(params, "state"), district: placeText(params, "district") }, Math.floor(boundedNumber(params, "limit", 1, 50, 15))); });
