"use client";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, Mail, MessageSquare, Phone, Send, ShieldAlert, X } from "lucide-react";
import { useLocationSafety } from "./LocationSafetyManager";
import type { EmergencyConfig, EmergencyInput, EmergencyReceipt, DeliveryState } from "@/shared/types/emergency";

const labels: Record<DeliveryState, string> = { accepted: "Accepted by provider · delivery not confirmed", failed: "Failed · call for help", unknown: "Unconfirmed · call for help", "not-configured": "Not connected · no message sent" };
export function EmergencyHelp() {
  const { location, locateOnce, locating } = useLocationSafety();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<EmergencyInput | null>(null);
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState("");
  const [config, setConfig] = useState<EmergencyConfig | null>(null), [receipt, setReceipt] = useState<EmergencyReceipt | null>(null);
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [people, setPeople] = useState(1), [disaster, setDisaster] = useState("Flood"), [message, setMessage] = useState(""), [landmark, setLandmark] = useState(""), [consent, setConsent] = useState(false);
  useEffect(() => { const show = () => setOpen(true); window.addEventListener("suraksha-open-emergency", show); return () => window.removeEventListener("suraksha-open-emergency", show); }, []);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    if (!dialog.current?.open) dialog.current?.showModal();
    const controller = new AbortController();
    fetch("/api/emergency", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: "no-store" }).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(setConfig).catch(() => { if (!controller.signal.aborted) setError("Could not check the delivery service. You can still call for help."); });
    return () => controller.abort();
  }, [open]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const input = pending.current ?? { requestId: crypto.randomUUID(), name, phone, people, disaster, message, locationText: [landmark, location?.name || location?.district || location?.state || (location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "")].filter(Boolean).join(" · ").slice(0, 300), ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}), consent: true as const };
    pending.current = input; inFlight.current = true; setSending(true); setError("");
    try {
      const response = await fetch("/api/emergency", { method: "POST", signal: AbortSignal.timeout(30000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) { if ([400, 403, 413, 415, 429].includes(response.status)) pending.current = null; throw new Error(result.error || "Request status is unavailable."); }
      setReceipt(result);
    } catch (failure) { setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Delivery is unconfirmed. Check this request again or call for help."); }
    finally { inFlight.current = false; setSending(false); }
  }
  const configured = !!(config?.email || config?.sms);
  const canCheck = receipt?.email === "unknown" || receipt?.sms === "unknown";
  return <><button className="emergency-fab" onClick={() => setOpen(true)} aria-haspopup="dialog"><ShieldAlert size={18} />SOS · Need help?</button>
    <dialog className="emergency-help-dialog" ref={dialog} onClose={() => setOpen(false)} aria-labelledby="emergency-help-title"><div className="emergency-help-heading"><span><ShieldAlert size={24} /></span><div><small>SURAKSHA SETU · EMERGENCY ASSISTANCE</small><h2 id="emergency-help-title">Get help to your location</h2></div><button type="button" aria-label="Close emergency request" onClick={() => setOpen(false)}><X size={21} /></button></div>
      <div className="emergency-callout"><p>In immediate danger? Call emergency services now.</p><a href="tel:112"><Phone size={17} />Call 112</a></div>
      <p className="emergency-description">Submit your situation once to automatically email and text the configured response team.</p>
      <div className="emergency-connection"><strong>{config?.authority || "Checking response team…"}</strong><span><Mail size={14} />Email {config?.email ? "connected" : "not connected"}</span><span><MessageSquare size={14} />SMS {config?.sms ? "connected" : "not connected"}</span></div>
      {config && !configured && <p className="emergency-notice">Prototype setup pending. Automatic messages cannot be sent yet. Use Call 112 for an emergency.</p>}
      <form onSubmit={submit}><fieldset disabled={sending || !!pending.current} className="emergency-fields"><div className="emergency-form-row"><label>Your name<input required maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label><label>Callback number<input type="tel" required minLength={7} maxLength={20} autoComplete="tel" placeholder="+91…" value={phone} onChange={e => setPhone(e.target.value)} /></label></div><div className="emergency-form-row"><label>What happened?<select value={disaster} onChange={e => setDisaster(e.target.value)}>{["Flood", "Landslide", "Earthquake", "Cyclone", "Fire", "Extreme weather", "Other emergency"].map(kind => <option key={kind}>{kind}</option>)}</select></label><label>People needing help<input type="number" min={1} max={10000} required value={people} onChange={e => setPeople(Number(e.target.value))} /></label></div><label>Where are you? / nearby landmark<input required={!location} minLength={location ? undefined : 3} maxLength={180} placeholder="Building, road, village or a visible landmark" value={landmark} onChange={e => setLandmark(e.target.value)} /></label><div className="emergency-location"><span>{location ? `${location.name || "Selected location"} · ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "No coordinates selected. Enter your location above."}</span><button type="button" onClick={locateOnce} disabled={locating}><LocateFixed size={14} />{locating ? "Locating…" : "Use GPS"}</button></div><label>Describe the help you need<textarea required minLength={5} maxLength={1200} rows={3} placeholder="For example: stranded on the second floor; need evacuation." value={message} onChange={e => setMessage(e.target.value)} /></label><label className="emergency-consent"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to share these details, my callback number and the location shown above with the response team.</label></fieldset>
        {receipt && <div className="emergency-receipt" role="status"><strong>Request reference: {receipt.requestId}</strong><p>Email: {labels[receipt.email]}</p><p>SMS: {labels[receipt.sms]}</p><small>Provider acceptance does not confirm rescue dispatch or authority acknowledgement.</small></div>}
        {error && <p role="alert" className="emergency-notice">{error}</p>}
        {pending.current && !receipt && <p className="emergency-description">Reference: {pending.current.requestId}. Checking again will reuse this request to prevent duplicates.</p>}
        <button className="emergency-submit" type="submit" disabled={sending || !configured || !consent || (!!receipt && !canCheck)}><Send size={16} />{sending ? "Checking request…" : canCheck || (pending.current && !receipt) ? "Check this request again" : receipt ? "Request processed — see status above" : "Send help request"}</button>
        {receipt && <button className="alerts-text-button" type="button" onClick={() => { pending.current = null; setReceipt(null); setError(""); setConsent(false); setMessage(""); }}>Start a different help request</button>}
      </form><p className="emergency-description">Messages require internet access. This prototype does not track a rescue response.</p>
    </dialog></>;
}
