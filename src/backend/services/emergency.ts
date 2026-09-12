import type { EmergencyConfig, EmergencyInput, DeliveryState } from "../../shared/types/emergency";
import { RequestError } from "./request-guard";

export function parseEmergency(value: unknown): EmergencyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError("Invalid help request.");
  const v = value as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => {
    const s = v[key]; if (typeof s !== "string" || s.trim().length < min || s.length > max || /[\u0000-\u0008\u000b-\u001f]/.test(s)) throw new RequestError(`Please check ${key}.`); return s.trim();
  };
  const requestId = text("requestId", 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new RequestError("Invalid request reference.");
  if (v.consent !== true) throw new RequestError("Consent is required to share your help request.");
  if (!Number.isInteger(v.people) || Number(v.people) < 1 || Number(v.people) > 10000) throw new RequestError("Enter between 1 and 10,000 people.");
  const phone = text("phone", 7, 20);
  if (!/^\+?[\d ()-]{7,20}$/.test(phone) || phone.replace(/\D/g, "").length < 7) throw new RequestError("Enter a callback phone number.");
  const locationText = text("locationText", 3, 300);
  const latitude = v.latitude, longitude = v.longitude;
  if ((latitude !== undefined || longitude !== undefined) && (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98)) throw new RequestError("The location must be within India.");
  return { requestId, name: text("name", 1, 80), phone, people: Number(v.people), disaster: text("disaster", 1, 60), message: text("message", 5, 1200), locationText, consent: true, ...(typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : {}) };
}

export function emergencyConfig(env: Record<string, string | undefined> = process.env): EmergencyConfig {
  const enabled = env.EMERGENCY_DELIVERY_ENABLED === "true";
  return { authority: env.EMERGENCY_AUTHORITY_NAME || "Response team not configured", email: enabled && !!env.RESEND_API_KEY && !!env.EMERGENCY_FROM_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EMERGENCY_TO_EMAIL || ""), sms: enabled && /^AC[a-f0-9]{32}$/i.test(env.TWILIO_ACCOUNT_SID || "") && !!env.TWILIO_AUTH_TOKEN && /^\+[1-9]\d{7,14}$/.test(env.TWILIO_FROM_NUMBER || "") && /^\+[1-9]\d{7,14}$/.test(env.EMERGENCY_TO_SMS || "") };
}

export function emergencyMessage(input: EmergencyInput) {
  return `SURAKSHA SETU - HELP REQUEST\nReference: ${input.requestId}\nName: ${input.name}\nCallback: ${input.phone}\nPeople needing help: ${input.people}\nIncident: ${input.disaster}\nLocation: ${input.locationText}\n${input.latitude !== undefined ? `Coordinates: ${input.latitude}, ${input.longitude}\nMap: https://www.google.com/maps/search/?api=1&query=${input.latitude},${input.longitude}\n` : "Coordinates not provided; use the landmark above.\n"}Situation: ${input.message}\nUser-submitted report; not independently verified.`;
}

export async function dispatchEmergency(channel: "email" | "sms", input: EmergencyInput, env: Record<string, string | undefined> = process.env, send: typeof fetch = fetch): Promise<DeliveryState> {
  if (!emergencyConfig(env)[channel]) return "not-configured";
  try {
    const message = emergencyMessage(input);
    const response = channel === "email" ? await send("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `emergency/${input.requestId}` }, body: JSON.stringify({ from: env.EMERGENCY_FROM_EMAIL, to: [env.EMERGENCY_TO_EMAIL], subject: "Suraksha Setu: emergency help request", text: message }) }) : await send(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: "POST", signal: AbortSignal.timeout(12000), headers: { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: env.TWILIO_FROM_NUMBER!, To: env.EMERGENCY_TO_SMS!, Body: message.slice(0, 1500) }) });
    if (!response.ok) return response.status >= 500 ? "unknown" : "failed";
    const body = await response.json();
    if (channel === "sms" && ["failed", "undelivered", "canceled"].includes(body.status)) return "failed";
    return typeof (channel === "email" ? body.id : body.sid) === "string" ? "accepted" : "unknown";
  } catch { return "unknown"; }
}
