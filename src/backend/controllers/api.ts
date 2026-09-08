import { getDashboardSummary } from "@/lib/server/dashboard";
import { getHabitations } from "@/lib/server/data";
import { buildRelocationPlan, getSafeSitesWithAllocations } from "@/lib/server/relocation";
import { simulateRisk } from "@/lib/server/simulation";
import type { SimulationInput } from "@/types/disaster";
import { readBoundedJson, RequestError } from "@/backend/services/request-guard";

export async function getDashboardSummaryResponse() {
  return Response.json(getDashboardSummary());
}

export async function getHabitationsResponse(request: Request) {
  const params = new URL(request.url).searchParams;
  const risk = params.get("risk")?.toUpperCase();
  const hazard = params.get("hazard")?.toUpperCase();
  const priority = params.get("priority")?.toUpperCase();
  const habitations = getHabitations().filter(
    (item) =>
      (!risk || risk === "ALL" || item.risk_category === risk) &&
      (!hazard || hazard === "ALL" || item.primary_hazard === hazard) &&
      (!priority || priority === "ALL" || item.priority_category === priority),
  );

  return Response.json(habitations);
}

export async function getHabitationResponse(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const habitation = getHabitations().find((item) => item.id === Number(id));
  if (!habitation) return Response.json({ error: "Habitation not found" }, { status: 404 });

  const recommendation = buildRelocationPlan().find((item) => item.habitation_id === habitation.id) ?? null;
  return Response.json({ ...habitation, recommendation });
}

export async function getRedZonesResponse() {
  return Response.json(getHabitations().filter((item) => item.risk_category === "RED"));
}

export async function getRelocationPlanResponse() {
  return Response.json(buildRelocationPlan());
}

export async function getSafeSitesResponse() {
  return Response.json(getSafeSitesWithAllocations());
}

export async function simulateRiskResponse(request: Request) {
  let body: Partial<SimulationInput>;
  try {
    const value = await readBoundedJson(request, 4096);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError("Expected a simulation object");
    body = value as Partial<SimulationInput>;
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : "Invalid JSON payload" }, { status: error instanceof RequestError ? error.status : 400 });
  }

  if (
    typeof body.habitation_id !== "number" ||
    typeof body.rainfall !== "number" ||
    typeof body.road_access !== "number" ||
    typeof body.population_vulnerability !== "number"
  ) {
    return Response.json(
      { error: "habitation_id, rainfall, road_access, and population_vulnerability are required numbers" },
      { status: 400 },
    );
  }

  if (!Number.isSafeInteger(body.habitation_id) || body.habitation_id! < 1 ||
    [body.rainfall, body.road_access, body.population_vulnerability, ...(body.hazard_intensity === undefined ? [] : [body.hazard_intensity])]
      .some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) {
    return Response.json({ error: "Use a valid habitation ID and finite scenario values between 0 and 100" }, { status: 400 });
  }

  const result = simulateRisk(body as SimulationInput);
  if (!result) return Response.json({ error: "Habitation not found" }, { status: 404 });
  return Response.json(result);
}
