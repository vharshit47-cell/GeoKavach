import { createHash } from "node:crypto";

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Single-instance MVP limiter. The deployment proxy must strip untrusted forwarding headers. */
const windows = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  for (const [id, window] of windows) if (window.reset <= now) windows.delete(id);
  if (windows.size >= 5000 && !windows.has(key)) return { allowed: false, retryAfter: 60 };
  const window = windows.get(key) ?? { count: 0, reset: now + windowMs };
  window.count += 1;
  windows.set(key, window);
  return { allowed: window.count <= limit, retryAfter: Math.max(1, Math.ceil((window.reset - now) / 1000)) };
}

export function clientBucket(request: Request) {
  // Forwarded IP is used only with explicitly configured trusted reverse proxy.
  const ip = process.env.TRUST_PROXY === "true" ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown") : "shared";
  return createHash("sha256").update(ip.slice(0, 100)).digest("hex").slice(0, 20);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new RequestError("Cross-origin requests are not allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new RequestError("Cross-site requests are not allowed.", 403);
}

export async function readBoundedJson(request: Request, maxBytes = 24_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new RequestError("Content-Type must be application/json.", 415);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new RequestError("Request is too large.", 413);
  if (!request.body) throw new RequestError("A JSON request body is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RequestError("Request is too large.", 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new RequestError("Invalid JSON payload."); }
  } finally { reader.releaseLock(); }
}
