import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseEmergency, emergencyConfig, dispatchEmergency, emergencyMessage } from "../src/backend/services/emergency";
import { EmergencyStore } from "../src/backend/services/emergency-store";
import { nearbyRelocationSites } from "../src/shared/safety";
import type { EmergencyInput } from "../src/shared/types/emergency";
import type { SiteRecord, Snapshot } from "../src/shared/workflow/model";

const input = (): EmergencyInput => ({ requestId: randomUUID(), name: "Test person", phone: "+919999999999", people: 3, disaster: "Flood", message: "TEST ONLY - no assistance required", locationText: "Test landmark, Delhi", latitude: 28.6, longitude: 77.2, consent: true });
const env = { EMERGENCY_DELIVERY_ENABLED: "true", EMERGENCY_AUTHORITY_NAME: "Test response team", RESEND_API_KEY: "test-key", EMERGENCY_FROM_EMAIL: "sender@example.test", EMERGENCY_TO_EMAIL: "recipient@example.test", TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`, TWILIO_AUTH_TOKEN: "test-token", TWILIO_FROM_NUMBER: "+12025550123", EMERGENCY_TO_SMS: "+919999999999" };

test("SOS rejects missing consent, invalid coordinates, bad people counts and oversized messages", () => {
  for (const patch of [{ consent: false }, { latitude: 0 }, { longitude: undefined }, { latitude: Infinity }, { people: 0 }, { people: 1.5 }, { phone: "abcdefg" }, { message: "x".repeat(1201) }, { requestId: "not-a-uuid" }]) assert.throws(() => parseEmergency({ ...input(), ...patch }));
  assert.equal(parseEmergency(input()).people, 3);
  const manual = input(); delete manual.latitude; delete manual.longitude;
  assert.equal(parseEmergency(manual).latitude, undefined);
  assert.match(emergencyMessage(manual), /Coordinates not provided/);
});
test("delivery is opt-in and unavailable channels make no network call", async () => {
  let calls = 0;
  const send = (async () => { calls++; return Response.json({}); }) as typeof fetch;
  assert.equal(emergencyConfig({ ...env, EMERGENCY_DELIVERY_ENABLED: "false" }).email, false);
  assert.equal(emergencyConfig({ ...env, EMERGENCY_TO_SMS: "112" }).sms, false);
  assert.equal(await dispatchEmergency("email", input(), {}, send), "not-configured");
  assert.equal(calls, 0);
});
test("email and SMS use server-configured recipients and report provider acceptance truthfully", async () => {
  const request = input();
  const email = (async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.deepEqual(JSON.parse(String(init?.body)).to, [env.EMERGENCY_TO_EMAIL]);
    assert.equal((init?.headers as Record<string, string>)["Idempotency-Key"], `emergency/${request.requestId}`);
    return Response.json({ id: "test-provider-id" });
  }) as typeof fetch;
  assert.equal(await dispatchEmergency("email", request, env, email), "accepted");
  const sms = (async (_url, init) => { const body = new URLSearchParams(String(init?.body)); assert.equal(body.get("To"), env.EMERGENCY_TO_SMS); assert.match(body.get("Body")!, /28.6, 77.2/); return Response.json({ sid: "SM-test", status: "queued" }); }) as typeof fetch;
  assert.equal(await dispatchEmergency("sms", request, env, sms), "accepted");
  assert.equal(await dispatchEmergency("sms", request, env, (async () => Response.json({ sid: "SM-test", status: "failed" })) as typeof fetch), "failed");
});
test("provider errors and ambiguous timeouts never report delivery success", async () => {
  assert.equal(await dispatchEmergency("email", input(), env, (async () => new Response("", { status: 401 })) as typeof fetch), "failed");
  assert.equal(await dispatchEmergency("sms", input(), env, (async () => { throw new Error("timeout"); }) as typeof fetch), "unknown");
  assert.equal(await dispatchEmergency("email", input(), env, (async () => new Response("", { status: 500 })) as typeof fetch), "unknown");
});
test("concurrent and repeated SOS requests cannot send duplicate messages", async () => {
  const store = new EmergencyStore(":memory:"); const request = input(); let calls = 0;
  try {
    const dispatch = async () => { calls++; await Promise.resolve(); return "accepted" as const; };
    const [first] = await Promise.all([store.submit(request, { email: true, sms: true }, dispatch), store.submit(request, { email: true, sms: true }, dispatch)]);
    assert.equal(first.sms, "accepted");
    assert.deepEqual(await store.submit(request, { email: true, sms: true }, dispatch), first);
    assert.equal(calls, 2);
    await assert.rejects(() => store.submit({ ...request, people: 4 }, { email: true, sms: true }, dispatch), /already used/);
  } finally { store.close(); }
});
test("failed and unknown channels remain separate and are not resent on replay", async () => {
  const store = new EmergencyStore(":memory:"); const request = input(); let calls = 0;
  try {
    const dispatch = async (channel: string) => { calls++; return channel === "email" ? "accepted" as const : "unknown" as const; };
    const receipt = await store.submit(request, { email: true, sms: true }, dispatch);
    assert.equal(receipt.email, "accepted"); assert.equal(receipt.sms, "unknown");
    await store.submit(request, { email: true, sms: true }, dispatch); assert.equal(calls, 2);
  } finally { store.close(); }
});
test("nearby relocation screening excludes stale, unverified, full, distant and high-hazard sites", () => {
  const base: SiteRecord = { id: "near", name: "Test site", latitude: 28.61, longitude: 77.21, land: 100, water: 100, sanitation: 100, shelter: 100, occupied: 10, hazard: 1, verified: true, evidence: "Test assessment", assessedAt: new Date().toISOString(), version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const snapshot: Snapshot = { actor: null, localAvailable: true, cases: [], plans: [], audit: [], sites: [base, { ...base, id: "old", assessedAt: "2020-01-01" }, { ...base, id: "unverified", verified: false }, { ...base, id: "full", occupied: 100 }, { ...base, id: "dangerous", hazard: 3 }, { ...base, id: "distant", latitude: 20 }] };
  assert.deepEqual(nearbyRelocationSites({ latitude: 28.6, longitude: 77.2 }, snapshot).map(s => s.site.id), ["near"]);
  snapshot.plans.push({ id: "plan", caseId: "case", siteId: "near", caseVersion: 1, siteVersion: 1, population: 90, status: "Approved", createdAt: "", updatedAt: "", note: "" });
  assert.equal(nearbyRelocationSites({ latitude: 28.6, longitude: 77.2 }, snapshot).length, 0);
});
