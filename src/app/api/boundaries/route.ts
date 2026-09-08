import { InputError, liveRoute, placeText } from "@/backend/controllers/live-api";
import { getBoundaries } from "@/backend/providers/boundaries";
export const runtime = "nodejs";
export const GET = liveRoute(async params => { const level = params.get("level") || "ADM1"; if (level !== "ADM0" && level !== "ADM1" && level !== "ADM2") throw new InputError("level must be ADM0, ADM1 or ADM2"); return getBoundaries(level, placeText(params, "state")); }, 20);
