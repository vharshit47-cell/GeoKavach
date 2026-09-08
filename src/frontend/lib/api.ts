import type { DashboardSummary, Habitation, RelocationRecommendation, SafeSite, SimulationInput, SimulationResult } from "@/types/disaster";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(20000),
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  habitations: () => request<Habitation[]>("/api/habitations"),
  habitation: (id: number) => request<Habitation & { recommendation: RelocationRecommendation | null }>(`/api/habitations/${id}`),
  redZones: () => request<Habitation[]>("/api/red-zones"),
  safeSites: () => request<SafeSite[]>("/api/safe-sites"),
  relocationPlan: () => request<RelocationRecommendation[]>("/api/relocation-plan"),
  dashboardSummary: () => request<DashboardSummary>("/api/dashboard-summary"),
  simulateRisk: (input: SimulationInput) => request<SimulationResult>("/api/simulate-risk", { method: "POST", body: JSON.stringify(input) }),
};

