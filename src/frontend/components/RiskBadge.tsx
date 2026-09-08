"use client";
import { usePreferences } from "./AppPreferences";
import { PRIORITY_STYLES, RISK_STYLES } from "@/config/risk";
import type { PriorityCategory, RiskCategory } from "@/types/disaster";

export function RiskBadge({ value }: { value: RiskCategory }) {
  const { tr } = usePreferences();
  const style = RISK_STYLES[value];
  return <span className="tone-badge" style={{ color: style.color, background: style.soft }}><i style={{ background: style.color }} />{tr(style.label)}</span>;
}

export function PriorityBadge({ value }: { value: PriorityCategory }) {
  const { tr } = usePreferences();
  const style = PRIORITY_STYLES[value];
  return <span className="tone-badge" style={{ color: style.color, background: style.soft }}>{tr(style.label)}</span>;
}

