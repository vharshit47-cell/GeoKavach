"use client";
import { useCallback, useEffect, useState } from "react";
import type { BoundaryData, SourceResult } from "@/types/intelligence";
import type { Snapshot } from "@/shared/workflow/model";

export function useMapWorkflow() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    fetch("/api/workflow", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<Snapshot>; })
      .then(value => { if (!Array.isArray(value.cases) || !Array.isArray(value.sites) || !Array.isArray(value.plans)) throw new Error(); if (active) { setSnapshot(value); setError(false); } })
      .catch(() => { if (active) { setError(true); setSnapshot(null); } })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [revision]);
  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, [refresh]);
  return { snapshot, loading, error, refresh };
}

// Fetch simplified boundaries only for enabled layers; district requests are state-scoped.
export function useMapBoundary(level: "ADM1" | "ADM2", enabled: boolean, state?: string) {
  const [result, setResult] = useState<SourceResult<BoundaryData | null> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    setResult(null); setLoading(true); setError(false);
    const query = new URLSearchParams({ level });
    if (state) query.set("state", state);
    fetch(`/api/boundaries?${query}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<SourceResult<BoundaryData | null>>; })
      .then(value => { if (active) { setResult(value); setError(value.status === "unavailable"); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [enabled, level, state, revision]);
  return { result, loading, error, retry };
}
