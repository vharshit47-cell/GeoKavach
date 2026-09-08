"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import liveEn from "@/i18n/live-en.json";
import liveHi from "@/i18n/live-hi.json";
import legacyEn from "@/i18n/legacy-en.json";
import legacyHi from "@/i18n/legacy-hi.json";
import type { Language } from "@/shared/types/profile";
import { getSupabaseBrowserClient } from "@/frontend/lib/supabase/client";

type PreferencesContext = {
  language: Language; setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tr: (text: string) => string;
  theme: string; setTheme: (theme: string) => void;
};
const dictionaries: Record<Language, Record<string, string>> = { en: { ...en, ...liveEn }, hi: { ...hi, ...liveHi } };
const legacy: Record<Language, Record<string, string>> = { en: legacyEn, hi: legacyHi };
const Context = createContext<PreferencesContext | null>(null);

function Preferences({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>("en");
  const { theme = "system", setTheme } = useTheme();
  const applyLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    document.documentElement.lang = next;
    try { localStorage.setItem("suraksha-language", next); } catch { /* Private browsing can disable persistence. */ }
    document.cookie = `suraksha-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);
  useEffect(() => {
    const resetDevice = () => applyLanguage("en");
    window.addEventListener("suraksha-reset-device", resetDevice);
    return () => window.removeEventListener("suraksha-reset-device", resetDevice);
  }, [applyLanguage]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("suraksha-language") || document.cookie.match(/(?:^|; )suraksha-language=(en|hi)(?:;|$)/)?.[1];
      applyLanguage(saved === "hi" ? "hi" : "en");
    } catch { applyLanguage("en"); }
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let alive = true;
    const loadProfile = () => {
      void fetch("/api/profile", { cache: "no-store" }).then(async response => {
        if (!response.ok || !alive) return;
        const data = await response.json();
        if (!alive) return;
        if (["en", "hi"].includes(data.profile?.preferred_language)) applyLanguage(data.profile.preferred_language);
        if (data.preferences) {
          try { localStorage.setItem("suraksha-notification-preferences", JSON.stringify(data.preferences)); } catch { /* Device storage unavailable. */ }
          window.dispatchEvent(new CustomEvent("suraksha-preferences-changed"));
        }
      }).catch(() => {});
    };
    // Keep the auth callback synchronous; database calls happen outside the Auth lock.
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) setTimeout(loadProfile, 0);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [applyLanguage]);

  const setLanguage = useCallback((next: Language) => {
    applyLanguage(next);
    if (getSupabaseBrowserClient()) void fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferred_language: next }) }).catch(() => {});
  }, [applyLanguage]);
  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let value = dictionaries[language][key] || dictionaries.en[key] || legacy[language][key] || key;
    if (params) for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
    return value;
  }, [language]);
  const tr = useCallback((text: string) => legacy[language][text] || dictionaries[language][text] || text, [language]);
  const value = useMemo(() => ({ language, setLanguage, t, tr, theme, setTheme }), [language, setLanguage, t, tr, theme, setTheme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="suraksha-theme" disableTransitionOnChange><Preferences>{children}</Preferences></ThemeProvider>;
}
export function usePreferences() {
  const context = useContext(Context);
  if (!context) throw new Error("usePreferences must be used within AppPreferencesProvider");
  return context;
}
