"use client";
import { usePreferences } from "./AppPreferences";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { Habitation } from "@/types/disaster";
import { PriorityBadge, RiskBadge } from "./RiskBadge";

export function CriticalHabitations({ habitations, onSelect }: { habitations: Habitation[]; onSelect: (habitation: Habitation) => void }) {
  const { tr } = usePreferences();
  const rows = [...habitations].sort((a, b) => b.priority_score - a.priority_score).slice(0, 6);
  return <section className="content-card critical-list"><div className="card-heading"><div><span className="section-kicker">{tr("RELOCATION PRIORITY QUEUE")}</span><h2>{tr("Critical habitations")}</h2><p>{tr("Ranked by risk, vulnerability, and disaster history.")}</p></div><TriangleAlert size={20} /></div><div className="critical-table"><div className="critical-header"><span>{tr("Rank")}</span><span>{tr("Habitation")}</span><span>{tr("Population")}</span><span>{tr("Risk")}</span><span>{tr("Priority")}</span><span>{tr("Action")}</span></div>{rows.map((item, index) => <button key={item.id} onClick={() => onSelect(item)}><span>{String(index + 1).padStart(2, "0")}</span><span><strong>{item.name}</strong><small>{tr(item.primary_hazard.toLowerCase())}</small></span><span>{item.population.toLocaleString("en-IN")}</span><span><RiskBadge value={item.risk_category} /></span><span><PriorityBadge value={item.priority_category} /></span><span>{tr(item.recommended_action)}<ArrowRight size={14} /></span></button>)}</div></section>;
}

