import { emergencyConfig, parseEmergency, dispatchEmergency } from "@/backend/services/emergency";
import { emergencyStore } from "@/backend/services/emergency-store";
import { clientBucket, rateLimit, readBoundedJson, requireSameOrigin, RequestError } from "@/backend/services/request-guard";

export const runtime = "nodejs";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export function GET() { return json(emergencyConfig()); }
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!rateLimit(`emergency:${clientBucket(request)}`, 5, 60000).allowed) return json({ error: "Too many requests. Wait a minute before checking again, or call emergency services." }, 429);
    const input = parseEmergency(await readBoundedJson(request, 6000));
    const config = emergencyConfig();
    if (!config.email && !config.sms) return json({ error: "Automatic delivery is not configured. No message has been sent. Use the emergency call option." }, 503);
    return json(await emergencyStore().submit(input, config, channel => dispatchEmergency(channel, input)));
  } catch (error) {
    return json({ error: error instanceof RequestError ? error.message : "Delivery status could not be confirmed. Keep this request open to check again, or call emergency services." }, error instanceof RequestError ? error.status : 503);
  }
}
