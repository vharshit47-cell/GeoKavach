"use client";
import {useState} from "react";
import {Download,Search,ArrowDownUp} from "lucide-react";
import {useSurakshaData} from "@/hooks/use-suraksha-data";
import type {Habitation} from "@/types/disaster";
import {recommendationForHabitation} from "@/shared/config/assessment";
import {AppShell} from "./AppShell";
import {HabitationDetailPanel} from "./HabitationDetailPanel";
import {RiskBadge} from "./RiskBadge";
import {ErrorState,LoadingState} from "./LoadingState";
const labels={CRITICAL:"Immediate",HIGH:"Short-term",MEDIUM:"Medium-term",MONITOR:"Monitor"};
export function HabitationsPage(){
 const {habitations,safeSites,relocationPlan,loading,error,retry}=useSurakshaData();
 const [filter,setFilter]=useState("All"),[search,setSearch]=useState(""),[sort,setSort]=useState<"risk_score"|"population"|"priority_score">("risk_score"),[desc,setDesc]=useState(true),[selected,setSelected]=useState<Habitation|null>(null);
 const filtered=habitations.filter(h=>(filter==="All"||labels[h.priority_category]===filter)&&`${h.name} ${h.district}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(desc?b[sort]-a[sort]:a[sort]-b[sort])||a.id-b.id);
 const exportRows=()=>{
  const escape=(v:unknown)=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const rows=[["Priority","Habitation","District","Population","Risk Score","Priority Level"],...filtered.map((h,i)=>[i+1,h.name,h.district,h.population,h.risk_score,labels[h.priority_category]])];
  const url=URL.createObjectURL(new Blob(["\uFEFF"+rows.map(r=>r.map(escape).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="surakshasetu-relocation-priorities.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <AppShell title="Relocation Priority List" description="Model-based ranking of habitations by multi-hazard risk and vulnerability. AI explanations are available.">
 {loading?<LoadingState/>:error?<ErrorState message={error} onRetry={retry}/>:<section className="content-card data-table-card"><div className="table-toolbar"><div className="segmented">{["All","Immediate","Short-term","Medium-term"].map(f=><button key={f} className={filter===f?"active":""} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div><label className="search-field"><Search size={14}/><input placeholder="Search habitation or district" aria-label="Search habitation or district" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Sort priorities by" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="risk_score">Risk Score</option><option value="population">Population</option><option value="priority_score">Priority</option></select><button className="secondary-button" onClick={()=>setDesc(!desc)}><ArrowDownUp size={13}/>{desc?"Highest first":"Lowest first"}</button><button className="secondary-button" onClick={exportRows}><Download size={14}/>Export</button></div><p className="source-note">{filtered.length} of {habitations.length} habitations · demo assessment</p><div className="table-scroll"><table className="data-table"><thead><tr><th>#</th><th>Habitation</th><th>District</th><th>Population</th><th>Risk Score</th><th>Priority</th></tr></thead><tbody>{filtered.map((h,i)=><tr key={h.id} tabIndex={0} onClick={()=>setSelected(h)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(h);}}}><td>{i+1}</td><td><strong>{h.name}</strong></td><td>{h.district}</td><td>{h.population.toLocaleString("en-IN")}</td><td><strong>{h.risk_score}</strong> <RiskBadge value={h.risk_category}/></td><td><span className={`priority-filter ${labels[h.priority_category].toLowerCase()}`}>{labels[h.priority_category]}</span></td></tr>)}{!filtered.length&&<tr><td colSpan={6}>No habitations match these filters.</td></tr>}</tbody></table></div></section>}
 {selected&&<HabitationDetailPanel habitation={selected} recommendation={recommendationForHabitation(selected,safeSites,relocationPlan)} onClose={()=>setSelected(null)} onFindRelocation={()=>{window.location.href=`/relocation?habitation=${selected.id}`;}}/>}
 </AppShell>;
}

