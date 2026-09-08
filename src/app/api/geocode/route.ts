import { InputError, liveRoute, locationInput, placeText } from "@/backend/controllers/live-api";
import { reverseLocation, searchLocations } from "@/backend/providers/geocoding";
export const runtime = "nodejs";
export const GET = liveRoute(async params => { const query = placeText(params, "q"); if (query) { if (query.length < 2) throw new InputError("Search must contain at least two characters"); return searchLocations(query); } const location = locationInput(params)!; return reverseLocation(location.latitude, location.longitude); }, 20);
