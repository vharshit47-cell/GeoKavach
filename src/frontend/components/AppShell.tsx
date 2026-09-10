"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { usePreferences } from "./AppPreferences";
import { Header } from "./Header";

export function AppShell({ children, title, description, actions }: { children: ReactNode; title: string; description: string; actions?: ReactNode }) {
  const { t, tr, language } = usePreferences();
  const path = usePathname();
  const demo = false;
  return (
    <div className="app-frame">
      <Header />

      <main className="page-shell">
        <div className="page-heading">
          <div><span className="section-kicker">{t("app.kicker")}</span><h1>{tr(title)}</h1><p>{tr(description)}</p></div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
        {demo && <aside className="demo-notice"><strong>{tr("Demo Dataset")}</strong><span>{t("app.demoNotice")}</span></aside>}
        {children}
      </main>
      <footer className="app-footer"><span>GEOKAVACH · DECISION SUPPORT</span><span>{t("app.disclaimer")}</span></footer>
    </div>
  );
}
