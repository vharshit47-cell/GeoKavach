import { ArrowUpRight, Radio } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { DisasterAlert, EarthquakeEvent } from "@/types/intelligence";
import { alertColor, type Selection } from "@/frontend/lib/map/presentation";

export function CurrentEvidence({ alerts, earthquakes, available, loading, onSelect, chart = false }: {
  alerts: DisasterAlert[]; earthquakes: EarthquakeEvent[]; available: boolean; loading: boolean; onSelect: (selection: Selection) => void; chart?: boolean;
}) {
  const severity = (["extreme", "severe", "high", "moderate", "low", "unknown"] as const).map(key => ({ name: key, count: alerts.filter(alert => alert.severity === key).length, color: alertColor(key) })).filter(item => item.count > 0);
  return <section className="atlas-current-evidence"><h3><span className="atlas-live-label"><Radio size={13} />Current hazard signals</span><span>OFFICIAL / OBSERVED</span></h3>
    <div className="atlas-evidence-total"><strong>{loading && !available ? "…" : available ? alerts.length : "—"}</strong><div><b>Active official warnings</b><span>{available ? "NDMA SACHET · selected hazard" : loading ? "Connecting to the provider…" : "Hazard layer temporarily unavailable."}</span></div></div>
    {chart && severity.length > 0 && <div className="atlas-severity-chart" role="img" aria-label={`Official warning severity: ${severity.map(item => `${item.name} ${item.count}`).join(", ")}`}><ResponsiveContainer width="100%" height={Math.max(65, severity.length * 26)}><BarChart data={severity} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10, fill: "#788579" }} tickLine={false} axisLine={false} /><Bar dataKey="count" barSize={7} radius={[0, 3, 3, 0]} isAnimationActive={false}>{severity.map(item => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer><p className="atlas-footnote">Warning severity from the issuing authority; not a population risk rating.</p></div>}
    <div className="atlas-evidence-list">{alerts.slice(0, chart ? 3 : 4).map(alert => <button key={alert.id} onClick={() => onSelect({ kind: "alert", record: alert })}><i style={{ background: alertColor(alert.severity) }} /><span><strong>{alert.affectedArea || alert.title}</strong><small>{alert.hazardType.replace("-", " ")} · {alert.severity}</small></span><ArrowUpRight size={12} /></button>)}{earthquakes.slice(0, 2).map(quake => <button key={quake.id} onClick={() => onSelect({ kind: "earthquake", record: quake })}><i style={{ background: "#b97653" }} /><span><strong>{quake.place}</strong><small>USGS · M {quake.magnitude.toFixed(1)}</small></span><ArrowUpRight size={12} /></button>)}</div>
    {available && !alerts.length && <p className="atlas-muted">No matching active warning in the available feed. This does not establish safety.</p>}
    <p className="atlas-footnote">Population exposure and relocation needs require saved field assessments. No values are estimated from warning counts.</p>
  </section>;
}
