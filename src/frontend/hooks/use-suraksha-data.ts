"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardSummary, Habitation, RelocationRecommendation, SafeSite } from "@/types/disaster";

export type SurakshaData = {
  habitations: Habitation[];
  safeSites: SafeSite[];
  relocationPlan: RelocationRecommendation[];
  summary: DashboardSummary | null;
};

const initialData: SurakshaData = { habitations: [], safeSites: [], relocationPlan: [], summary: null };

export function useSurakshaData() {
  const [data, setData] = useState<SurakshaData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([api.habitations(), api.safeSites(), api.relocationPlan(), api.dashboardSummary()])
      .then(([habitations, safeSites, relocationPlan, summary]) => {
        if (active) setData({ habitations, safeSites, relocationPlan, summary });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load decision-support data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  return { ...data, loading, error, retry: () => setRevision((value) => value + 1) };
}

