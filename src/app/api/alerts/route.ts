import { liveRoute, locationInput } from "@/backend/controllers/live-api";
import { getAlerts } from "@/backend/providers/ndma";
export const runtime = "nodejs";
export const GET = liveRoute(async params => getAlerts(locationInput(params, true)));
