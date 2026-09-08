import type { LocationPoint } from "@/shared/types/intelligence";
import { RequestError } from "./request-guard";

export interface ChatInput {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  language: "en" | "hi";
  location?: LocationPoint;
  habitationId?: number;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseChatInput(value: unknown): ChatInput {
  if (!record(value) || !Array.isArray(value.messages) || value.messages.length < 1 || value.messages.length > 12) throw new RequestError("Send between 1 and 12 conversation messages.");
  let total = 0;
  const suppliedMessages = value.messages;
  const messages = suppliedMessages.map((message, index) => {
    if (!record(message) || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") throw new RequestError("Invalid conversation message.");
    const content = message.content.trim();
    if (!content || content.length > 2000) throw new RequestError("Each message must contain 1 to 2,000 characters.");
    if (index === 0 && message.role !== "user") throw new RequestError("Conversation must start with a user message.");
    if (index > 0 && suppliedMessages[index - 1].role === message.role) throw new RequestError("Conversation roles must alternate.");
    total += content.length;
    return { role: message.role as "user" | "assistant", content };
  });
  if (messages.at(-1)?.role !== "user" || total > 10_000) throw new RequestError("End with a user message and keep the conversation under 10,000 characters.");
  if (value.language !== undefined && value.language !== "hi" && value.language !== "en") throw new RequestError("Language must be en or hi.");
  const input: ChatInput = { messages, language: value.language === "hi" ? "hi" : "en" };
  if (value.location !== undefined && value.location !== null) {
    const loc = value.location;
    if (!record(loc) || typeof loc.latitude !== "number" || typeof loc.longitude !== "number" || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || loc.latitude < 6 || loc.latitude > 38 || loc.longitude < 68 || loc.longitude > 98) throw new RequestError("Choose coordinates within the India service area.");
    input.location = { latitude: loc.latitude, longitude: loc.longitude };
    for (const field of ["name", "state", "district"] as const) {
      if (loc[field] !== undefined) {
        if (typeof loc[field] !== "string" || loc[field].length > 120) throw new RequestError("Location labels must be at most 120 characters.");
        input.location[field] = loc[field].trim();
      }
    }
  }
  if (value.habitationId !== undefined) {
    if (typeof value.habitationId !== "number" || !Number.isSafeInteger(value.habitationId) || value.habitationId < 1) throw new RequestError("Invalid habitation ID.");
    input.habitationId = value.habitationId;
  }
  return input;
}
