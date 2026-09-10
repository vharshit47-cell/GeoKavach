"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, ChevronDown, UserRound } from "lucide-react";
import { usePreferences } from "./AppPreferences";

const navigation = [["/", "Home"], ["/map", "Live Map"], ["/alerts", "Alerts"], ["/relocation", "Relocation"]];

export function Header() {
  const path = usePathname();
  const { language, setLanguage } = usePreferences();

  return <header className="app-header">
    <Link href="/" className="app-brand" aria-label="GeoKavach home">
      <span className="brand-symbol"><ShieldCheck size={23} /></span>
      <span><strong>GEOKAVACH</strong><small>Intelligence for resilience</small></span>
    </Link>
    <nav className="primary-nav" aria-label="Primary navigation">
      {navigation.map(([href, label]) => <Link key={href} href={href} className={(path === href || href === "/analytics" && ["/dashboard", "/habitations", "/relocation", "/simulation"].includes(path)) ? "active" : ""} aria-current={path === href ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className="header-context">
      <details className="user-menu">
        <summary aria-label="Account menu"><span className="avatar"><UserRound size={16} /></span><span>Account</span><ChevronDown size={13} /></summary>
        <div><span className="menu-label">District workspace</span><Link href="/profile">Profile & account</Link><Link href="/settings">Settings</Link><Link href="/login">Sign in</Link><button onClick={() => setLanguage(language === "en" ? "hi" : "en")}>{language === "en" ? "हिन्दी" : "English"}</button></div>
      </details>
    </div>
  </header>;
}
