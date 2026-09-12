import "server-only";
import type { LineString } from "geojson";
import { RELOCATION_CONFIG } from "@/config/relocation";
import type { RelocationRoute, RelocationRouteStep } from "@/types/relocation";
import { fetchJson } from "@/backend/providers/core";

type Coordinates = { latitude: number; longitude: number };
type RawRecord = Record<string, unknown>;

export class RoutingError extends Error {}

function record(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawRecord : {};
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validCoordinates(point: Coordinates) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

async function json(url: string, init: RequestInit): Promise<unknown> {
  return fetchJson(url, { ...init, timeoutMs: RELOCATION_CONFIG.routing.timeoutMs, maxBytes: 4_000_000 });
}

function lineString(value: unknown): LineString | undefined {
  const geometry = record(value);
  if (geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) return;
  const coordinates = geometry.coordinates.filter((point): point is number[] => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite));
  return coordinates.length >= 2 ? { type: "LineString", coordinates } : undefined;
}

export function parseOpenRouteService(value: unknown): RelocationRoute {
  const features = record(value).features;
  const feature = Array.isArray(features) ? features[0] : undefined;
  const item = record(feature);
  const geometry = lineString(item.geometry);
  const properties = record(item.properties);
  const summary = record(properties.summary);
  const segments = Array.isArray(properties.segments) ? properties.segments : [];
  const steps: RelocationRouteStep[] = segments.flatMap(segment => {
    const values = record(segment).steps;
    return Array.isArray(values) ? values.flatMap(step => {
      const data = record(step); const instruction = typeof data.instruction === "string" ? data.instruction.trim() : "";
      const distanceMeters = finite(data.distance); const durationSeconds = finite(data.duration);
      return instruction && distanceMeters !== undefined && durationSeconds !== undefined ? [{ instruction, distanceMeters, durationSeconds }] : [];
    }) : [];
  });
  const distanceMeters = finite(summary.distance); const durationSeconds = finite(summary.duration);
  if (!geometry || distanceMeters === undefined || durationSeconds === undefined) throw new RoutingError("OpenRouteService returned an invalid route");
  return { geometry, distanceMeters, durationSeconds, steps, provider: "OpenRouteService", hazardCheck: "not-available", warnings: [] };
}

function osrmInstruction(step: RawRecord) {
  const maneuver = record(step.maneuver);
  const type = String(maneuver.type ?? "continue").replace(/_/g, " ");
  const modifier = String(maneuver.modifier ?? "").replace(/_/g, " ");
  const road = typeof step.name === "string" && step.name.trim() ? ` onto ${step.name.trim()}` : "";
  if (type === "depart") return road ? `Depart${road}` : "Depart on the mapped road";
  if (type === "arrive") return "Arrive at the destination";
  if (type === "roundabout" || type === "rotary") return `Enter the roundabout${road}`;
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}${modifier ? ` ${modifier}` : ""}${road}`;
}

export function parseOsrm(value: unknown): RelocationRoute {
  const routes = record(value).routes;
  const route = Array.isArray(routes) ? record(routes[0]) : {};
  const geometry = lineString(route.geometry);
  const distanceMeters = finite(route.distance); const durationSeconds = finite(route.duration);
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const steps: RelocationRouteStep[] = legs.flatMap(leg => {
    const values = record(leg).steps;
    return Array.isArray(values) ? values.flatMap(value => {
      const step = record(value); const distance = finite(step.distance); const duration = finite(step.duration);
      return distance !== undefined && duration !== undefined ? [{ instruction: osrmInstruction(step), distanceMeters: distance, durationSeconds: duration }] : [];
    }) : [];
  });
  if (!geometry || distanceMeters === undefined || durationSeconds === undefined) throw new RoutingError("OSRM returned an invalid route");
  return { geometry, distanceMeters, durationSeconds, steps, provider: "OSRM", hazardCheck: "not-available", warnings: [] };
}

async function openRouteService(source: Coordinates, destination: Coordinates) {
  const key = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!key) throw new RoutingError("OpenRouteService is not configured");
  const value = await json("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/geo+json, application/json" },
    body: JSON.stringify({ coordinates: [[source.longitude, source.latitude], [destination.longitude, destination.latitude]], instructions: true, language: "en", units: "m" }),
  });
  return parseOpenRouteService(value);
}

async function osrm(source: Coordinates, destination: Coordinates) {
  const coordinates = `${source.longitude},${source.latitude};${destination.longitude},${destination.latitude}`;
  const value = await json(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=false`, { method: "GET" });
  return parseOsrm(value);
}

export async function getRoadRoute(source: Coordinates, destination: Coordinates): Promise<RelocationRoute> {
  if (!validCoordinates(source) || !validCoordinates(destination)) throw new RoutingError("Invalid route coordinates");
  if (process.env.OPENROUTESERVICE_API_KEY?.trim()) {
    try { return await openRouteService(source, destination); }
    catch (error) { console.warn("OpenRouteService route unavailable; trying OSRM fallback", error instanceof Error ? error.message : "unknown error"); }
  }
  return osrm(source, destination);
}
