import { createRelocationPlan, evaluateFieldSite } from "@/backend/services/relocation-planner";
import { clientBucket, rateLimit, readBoundedJson, RequestError, requireSameOrigin } from "@/backend/services/request-guard";
import { privateJson } from "@/backend/supabase/http";
import { getAlerts } from "@/backend/providers/ndma";
import { getNearbyFacilities } from "@/backend/providers/osm";
import { workflowIdentity } from "@/backend/workflow/identity";
import { workflowStore } from "@/backend/workflow/store";
import { RELOCATION_CONFIG } from "@/config/relocation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!rateLimit(`relocation-plan:${clientBucket(request)}`, 12, 60_000).allowed) return privateJson({ error: "Too many relocation calculations. Retry in a minute." }, 429);
    const body = await readBoundedJson(request) as Record<string, unknown>;
    const habitationId = typeof body?.habitationId === "string" ? body.habitationId : "";
    if (!habitationId || habitationId.length > 100) throw new RequestError("A valid habitationId is required");
    const actor = await workflowIdentity(request);
    if (!actor) return privateJson({ error: "Sign in with an assigned workflow role or start a local prototype session" }, 401);
    const snapshot = workflowStore().snapshot(actor);
    const caseRecord = snapshot.cases.find(item => item.id === habitationId);
    if (!caseRecord) return privateJson({ error: "Habitation assessment not found in this workspace" }, 404);

    const alerts = await getAlerts({ latitude: caseRecord.latitude, longitude: caseRecord.longitude, name: caseRecord.name });
    const maximumRadius = RELOCATION_CONFIG.site.searchRadiiKm.at(-1) ?? 30;
    const knownCapacity = snapshot.sites
      .map(site => evaluateFieldSite(caseRecord, site, snapshot.plans, alerts.data, maximumRadius))
      .filter(site => site.eligible)
      .reduce((sum, site) => sum + (site.availableCapacity ?? 0), 0);
    const facilities = knownCapacity >= caseRecord.population
      ? []
      : (await getNearbyFacilities(caseRecord.latitude, caseRecord.longitude, maximumRadius)).data.slice(0, 12);
    return privateJson(await createRelocationPlan({ caseRecord, sites: snapshot.sites, plans: snapshot.plans, facilities, alerts }));
  } catch (error) {
    if (error instanceof RequestError) return privateJson({ error: error.message }, error.status);
    console.error("Relocation plan generation failed", error instanceof Error ? error.message : "unknown error");
    return privateJson({ error: "Relocation planning is temporarily unavailable. No route or safety data was fabricated." }, 503);
  }
}

export function GET() {
  return privateJson({ error: "Use POST with a saved habitationId" }, 405);
}
