"use client";
import { usePreferences } from "./AppPreferences";
import type { LucideIcon } from "lucide-react";

export function SummaryCard({ label, value, detail, icon: Icon, tone, tag }: { label: string; value: string; detail: string; icon: LucideIcon; tone: "blue" | "green" | "amber" | "slate" | "red" | "orange"; tag?: string }) {
  const { tr } = usePreferences();
  return (
    <article className="summary-card">
      <div className={`summary-icon ${tone}`}><Icon size={19} /></div>
      <div className="summary-main"><span>{tr(label)}</span><strong>{value}</strong><small>{tr(detail)}</small></div>
      {tag && <em className={`summary-tag ${tone}`}>{tr(tag)}</em>}
    </article>
  );
}
