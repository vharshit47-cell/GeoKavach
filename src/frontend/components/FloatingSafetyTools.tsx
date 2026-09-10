"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bot, MapPin, MessageCircle, Minus, Phone, Send, ShieldAlert, Trash2, X } from "lucide-react";
import { usePreferences } from "./AppPreferences";
import { useLocationSafety } from "./LocationSafetyManager";
import { timeLabel } from "@/frontend/lib/live-data";

type Message = { id: number; role: "user" | "assistant"; content: string; sources?: Array<{ name: string; status: string; updatedAt: string | null }> };

export function FloatingSafetyTools() {
  const { t, language } = usePreferences();
  const pathname = usePathname();
  const [chatHost, setChatHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (pathname !== "/assistant") { setChatHost(null); return; }
    const syncHost = () => setChatHost(document.getElementById("assistant-chat-host"));
    syncHost();
    // App Router can commit the streamed page after the shared layout effect.
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  const { location } = useLocationSafety();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [habitation, setHabitation] = useState<{ id: number; name: string } | null>(null);
  const chat = useRef<HTMLDialogElement>(null);
  const emergency = useRef<HTMLDialogElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  useEffect(() => { if (chatOpen && chat.current && !chat.current.open) chat.current.showModal(); else if (!chatOpen) chat.current?.close(); }, [chatOpen, chatHost]);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [messages, sending, error]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const select = (event: Event) => {
      const detail = (event as CustomEvent<{ id: number; name: string }>).detail;
      if (Number.isInteger(detail?.id) && detail.id > 0) { setHabitation(detail); setChatOpen(true); }
    };
    window.addEventListener("suraksha-ai-habitation", select);
    return () => window.removeEventListener("suraksha-ai-habitation", select);
  }, []);

  const clear = () => { request.current?.abort(); request.current = null; setMessages([]); setSending(false); setError(""); setDraft(""); };
  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const completed = messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
    const outgoing: Message[] = [...completed, { id: ++nextId.current, role: "user", content }];
    const contextMessages = outgoing.slice(-11).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    while (contextMessages.reduce((length, message) => length + message.content.length, 0) > 10000 && contextMessages.length > 1) contextMessages.splice(0, 2);
    setMessages(outgoing); setDraft(""); setError(""); setSending(true);
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ messages: contextMessages, language, ...(location ? { location } : {}), ...(habitation ? { habitationId: habitation.id } : {}) }) });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || typeof result.reply !== "string") { setError(result.code === "AI_NOT_CONFIGURED" ? "live.aiNotConfigured" : response.status === 429 ? "live.aiRateLimit" : "live.aiError"); return; }
      setMessages((previous) => [...previous, { id: ++nextId.current, role: "assistant", content: result.reply, sources: Array.isArray(result.sources) ? result.sources : [] }]);
    } catch { if (request.current === controller) setError("live.aiError"); }
    finally { window.clearTimeout(timeout); if (request.current === controller) { setSending(false); request.current = null; } }
  };

  const chatContent = <>
<div className="live-chat-header"><Bot size={23} /><div><h2 id="live-chat-title">GeoKavach AI Assistant</h2><span>{t("live.derived")}</span></div><button onClick={clear} aria-label={t("live.clearChat")} title={t("live.clearChat")}><Trash2 size={16} /></button>{!chatHost && <button onClick={() => setChatOpen(false)} aria-label={t("live.minimize")}><Minus size={20} /></button>}</div>
      <div className="live-chat-context"><MapPin size={13} /><span>{location?.name || location?.district || location?.state || t("live.aiNoLocation")}{habitation && <> · {t("live.demo")}: {habitation.name} <button className="live-text-button" onClick={() => setHabitation(null)} aria-label={t("live.close")}><X size={12} /></button></>}</span></div>
      <div className="live-chat-messages" ref={history} role="log" aria-live="polite" aria-relevant="additions text">{!messages.length && <div className="live-ai-welcome"><Bot size={34} /><p>{t("live.aiWelcome")}</p><div className="live-ai-prompts">{["Why is this habitation critical?", "Which habitation should be relocated first?", "Find the best relocation site for this habitation.", "Explain the risk score."].map((prompt) => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}</div></div>}{messages.map((message) => <article key={message.id} className={`live-chat-message ${message.role}`}><span>{message.role === "assistant" ? t("live.aiTitle") : t("live.you")}</span><p>{message.content}</p>{!!message.sources?.length && <details><summary>{t("live.sources")}</summary>{message.sources.map((source) => <small key={source.name}>{source.name} · {t(`live.sourceStatus.${source.status}`)} · {timeLabel(source.updatedAt, language)}</small>)}</details>}</article>)}{sending && <p className="live-ai-typing">{t("live.aiLoading")}</p>}{error && <div className="live-chat-error" role="alert">{t(error)}</div>}</div>
      <div className="live-chat-disclaimer"><ShieldAlert size={14} /><span>{t("live.aiDisclaimer")}</span></div><form className="live-chat-input" onSubmit={(event) => { event.preventDefault(); void send(draft); }}><label className="sr-only" htmlFor="suraksha-ai-message">{t("live.aiPlaceholder")}</label><textarea id="suraksha-ai-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("live.aiPlaceholder")} rows={2} maxLength={2000} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }} /><button type="submit" disabled={sending || !draft.trim()} aria-label={t("live.send")}><Send size={18} /></button></form>
  </>;
  const openEmergency = () => emergency.current?.showModal();
  return <>
    <div className="live-floating-tools"><button className="live-sos-button" onClick={openEmergency}><Phone size={17} /><span>{t("live.emergency")}</span></button><button className="live-ai-button" onClick={() => { if (chatHost) chatHost.querySelector("textarea")?.focus(); else setChatOpen(true); }} aria-haspopup={chatHost ? undefined : "dialog"}><MessageCircle size={19} /><span>{t("live.askAi")}</span></button></div>
    {chatHost ? createPortal(chatContent, chatHost) : <dialog className="live-chat-dialog" ref={chat} onClose={() => setChatOpen(false)} aria-labelledby="live-chat-title">{chatContent}</dialog>}
    <dialog ref={emergency} className="live-emergency-dialog" aria-labelledby="live-emergency-title"><button className="live-dialog-close" onClick={() => emergency.current?.close()} aria-label={t("live.close")}><X size={19} /></button><div className="live-emergency-icon"><Phone size={28} /></div><h2 id="live-emergency-title">{t("live.emergencyTitle")}</h2><p>{t("live.emergencyText")}</p><ul><li>{t("live.floodAction")}</li><li>{t("live.quakeAction")}</li><li>{t("live.landslideAction")}</li></ul><div className="live-emergency-actions"><button className="secondary-button" onClick={() => emergency.current?.close()}>{t("live.cancel")}</button><a className="live-call-button" href="tel:112" onClick={() => emergency.current?.close()}><Phone size={17} />{t("live.call")}</a></div></dialog>
  </>;
}
