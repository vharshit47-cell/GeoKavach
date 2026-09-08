"use client";
import { usePreferences } from "./AppPreferences";
import { CircleGauge, DatabaseZap, ShieldCheck, UsersRound } from "lucide-react";
import { RISK_STYLES } from "@/config/risk";
import type { DashboardSummary, Habitation } from "@/types/disaster";

export function RiskSummaryPanel({ summary, habitations }: { summary: DashboardSummary; habitations: Habitation[] }) {
  const { tr } = usePreferences();
  const population = habitations.reduce((sum, item) => sum + item.population, 0);
  return (
    <aside className="risk-summary panel-card">
      <div className="panel-heading"><span className="panel-icon"><CircleGauge size={16} /></span><div><span>{tr("LIVE ASSESSMENT")}</span><h2>{tr("Risk summary")}</h2></div></div>
      <div className="summary-focus"><span>{tr("Red Zones")}</span><strong>{summary.red_zones}</strong><small>{summary.immediate_relocation_population.toLocaleString("en-IN" )}{" "}{tr("people require immediate relocation planning")}</small></div>
      <div className="distribution-list">{(["RED", "HIGH", "MODERATE", "SAFE"] as const).map((risk) => {
        const count = habitations.filter((item) => item.risk_category === risk).length;
        return <div key={risk}><span><i style={{ background: RISK_STYLES[risk].color }} />{tr(RISK_STYLES[risk].label)}</span><strong>{count}</strong><div><span style={{ width: `${(count / Math.max(1, habitations.length)) * 100}%`, background: RISK_STYLES[risk].color }} /></div></div>;
      })}</div>
      <div className="summary-metrics"><div><UsersRound size={15} /><span>{tr("Mapped population")}</span><strong>{population.toLocaleString("en-IN")}</strong></div><div><ShieldCheck size={15} /><span>{tr("Assessed capacity")}</span><strong>{summary.total_available_capacity.toLocaleString("en-IN")}</strong></div></div>
      <div className="data-confidence"><DatabaseZap size={15} /><div><span>{tr("Data confidence")}</span><strong>{tr(summary.data_confidence.toLowerCase())}</strong></div><small>{summary.last_updated}</small></div>
    </aside>
  );
}

