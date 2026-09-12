import { liveRoute } from "@/backend/controllers/live-api";
import { getDisasterOccurrences } from "@/backend/providers/occurrences";

export const runtime = "nodejs";
export const GET = liveRoute(async () => getDisasterOccurrences(), 30);
