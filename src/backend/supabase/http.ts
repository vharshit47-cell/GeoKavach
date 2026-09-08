import "server-only";
import { NextResponse } from "next/server";

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Also supports authenticated non-browser requests.
  return origin === new URL(request.url).origin || origin === process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
}

export async function boundedJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!sameOrigin(request) || !request.headers.get("content-type")?.includes("application/json")) return null;
  if (Number(request.headers.get("content-length") || 0) > 8192) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
  try {
    const value = JSON.parse(text + decoder.decode());
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export function boundedText(value: unknown, max = 120) {
  return typeof value === "string" && value.trim().length <= max ? value.trim() : null;
}
