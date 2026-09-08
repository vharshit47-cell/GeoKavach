import type { LocationPoint } from "@/types/intelligence";
import { rateLimit } from "@/backend/providers/core";
export class InputError extends Error {}
export function boundedNumber(params: URLSearchParams, key: string, min: number, max: number, fallback?: number): number {
  const raw = params.get(key);
  if (raw == null && fallback !== undefined) return fallback;
  if (raw == null || !raw.trim()) throw new InputError(`${key} is required`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new InputError(`${key} must be between ${min} and ${max}`);
  return value;
}
export function placeText(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  if (!value) return;
  if (value.length > 100 || !/^[\p{L}\p{N}\s.,()'&-]+$/u.test(value)) throw new InputError(`Invalid ${key}`);
  return value;
}
export function locationInput(params: URLSearchParams, optional = false): LocationPoint | undefined {
  if (optional && !params.has("lat") && !params.has("lon")) return undefined;
  // Includes all Indian islands and national extents; not a political boundary assertion.
  return { latitude: boundedNumber(params, "lat", 6, 38), longitude: boundedNumber(params, "lon", 67, 98), state: placeText(params, "state"), district: placeText(params, "district") };
}
export function liveRoute(handler: (params: URLSearchParams) => Promise<unknown>, limit = 60) {
  return async (request: Request) => {
    const url = new URL(request.url);
    // A global route budget still bounds use when a client forges forwarding headers.
    const client = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim().slice(0, 100);
    if (!rateLimit(`route-global:${url.pathname}`, 300) || !rateLimit(`route:${url.pathname}:${client}`, limit)) return Response.json({ error: "Too many requests; try again in a minute" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    try { return Response.json(await handler(url.searchParams), { headers: { "Cache-Control": "private, no-store" } }); }
    catch (error) { return Response.json({ error: error instanceof InputError ? error.message : "Data temporarily unavailable" }, { status: error instanceof InputError ? 400 : 503 }); }
  };
}
