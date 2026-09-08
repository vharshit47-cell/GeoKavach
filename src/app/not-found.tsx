"use client";
import Link from "next/link";
import { usePreferences } from "@/components/AppPreferences";
export default function NotFound() {
 const { tr } = usePreferences();
 return <div className="state-card"><strong>{tr("Page not found")}</strong><span>{tr("This view is unavailable.")}</span><Link className="primary-button" href="/dashboard">{tr("Return to dashboard")}</Link></div>;
}
