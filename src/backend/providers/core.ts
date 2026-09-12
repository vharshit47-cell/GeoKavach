import type { SourceResult } from "@/types/intelligence";

type CacheEntry = { value?: SourceResult<unknown>; expires: number; pending?: Promise<SourceResult<unknown>> };
const cache = new Map<string, CacheEntry>();
const budgets = new Map<string, { count: number; until: number }>();

export function rateLimit(key: string, maximum = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  if (budgets.size > 4000) for (const [k, entry] of budgets) if (entry.until < now) budgets.delete(k);
  if (budgets.size > 5000) return false;
  const entry = budgets.get(key);
  if (!entry || entry.until <= now) { budgets.set(key, { count: 1, until: now + windowMs }); return true; }
  entry.count += 1;
  return entry.count <= maximum;
}

export function unavailable<T>(source: string, data: T, error = "Provider temporarily unavailable"): SourceResult<T> {
  return { source, attribution: source, data, status: "unavailable", fetchedAt: null, error };
}

/** Bounded process cache, request coalescing and failure cooldown. Use a shared store before horizontal scaling. */
export async function cachedProvider<T>(key: string, source: string, ttlMs: number, empty: T, fetcher: () => Promise<T>, note?: string): Promise<SourceResult<T>> {
  const existing = cache.get(key);
  if (existing?.pending) return existing.pending as Promise<SourceResult<T>>;
  if (existing?.value && existing.expires > Date.now()) {
    const value = existing.value as SourceResult<T>;
    return { ...value, status: value.status === "live" ? "cached" : value.status };
  }
  if (cache.size > 350) {
    for (const [k, entry] of cache) if (!entry.pending) { cache.delete(k); if (cache.size <= 300) break; }
  }
  const pending = (async (): Promise<SourceResult<T>> => {
    try {
      const data = await fetcher();
      const result: SourceResult<T> = { data, source, attribution: source, status: "live", fetchedAt: new Date().toISOString(), ...(note ? { note } : {}) };
      cache.set(key, { value: result, expires: Date.now() + ttlMs });
      return result;
    } catch (error) {
      const message = error instanceof ProviderError ? error.message : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "Provider request timed out; retry later" : "Provider temporarily unavailable";
      const old = existing?.value as SourceResult<T> | undefined;
      const oldAge = old?.fetchedAt ? Date.now() - Date.parse(old.fetchedAt) : Infinity;
      const result: SourceResult<T> = old && oldAge <= Math.max(ttlMs * 3, 30 * 60_000)
        ? { ...old, status: "stale", error: message }
        : unavailable(source, empty, message);
      cache.set(key, { value: result, expires: Date.now() + 60_000 });
      return result;
    }
  })();
  cache.set(key, { ...existing, expires: 0, pending });
  return pending;
}

export class ProviderError extends Error {}

export async function fetchText(url: string | URL, options: RequestInit & { maxBytes?: number; timeoutMs?: number } = {}): Promise<string> {
  const { maxBytes = 2_000_000, timeoutMs = 12_000, ...init } = options;
  const response = await fetch(url, {
    ...init, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": `SurakshaSet/1.0 (${process.env.NEXT_PUBLIC_APP_URL || "India disaster intelligence MVP"})`, ...init.headers },
  });
  if (!response.ok) throw new ProviderError(response.status === 429 ? "Provider rate limit reached; retry later" : `Provider unavailable (HTTP ${response.status})`);
  if (Number(response.headers.get("content-length")) > maxBytes) throw new ProviderError("Provider response exceeds size limit");
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError("Provider returned an empty response");
  const decoder = new TextDecoder(); let bytes = 0; let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new ProviderError("Provider response exceeds size limit"); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function fetchJson(url: string | URL, options?: Parameters<typeof fetchText>[1]): Promise<unknown> {
  const text = await fetchText(url, options);
  try { return JSON.parse(text); } catch { throw new ProviderError("Provider returned an invalid response"); }
}
export const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const array = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
export const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
export const cleanText = (value: unknown, length = 2000): string => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, length);
export function safeUrl(value: unknown): string | undefined {
  try { const url = new URL(String(value)); return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined; } catch { return undefined; }
}
export function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return;
  const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
export const coordinateKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function hazardFromText(value: string): import("@/types/intelligence").HazardKind {
  if (/cloudburst|cloud burst|बादल फट/i.test(value)) return "cloudburst";
  if (/landslide|भूस्खलन/i.test(value)) return "landslide";
  if (/earthquake|भूकंप/i.test(value)) return "earthquake";
  if (/flood|बाढ़/i.test(value)) return "flood";
  if (/cyclone|चक्रवात/i.test(value)) return "cyclone";
  if (/wildfire|forest fire|fire|आग/i.test(value)) return "fire";
  if (/rain|storm|lightning|avalanche|heat|wind|बारिश|वर्षा|बिजली/i.test(value)) return "extreme-weather";
  return "other";
}
