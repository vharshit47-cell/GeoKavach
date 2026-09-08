export type Role = "officer" | "administrator" | "coordinator";
export type Actor = { id: string; role: Role; workspace: string; local: boolean };
export const HAZARDS = ["flood", "landslide", "coastalErosion", "cloudburst"] as const;
export type CaseInput = { id?: string; version?: number; name: string; latitude: number; longitude: number; population: number; vulnerable: number; history: number; hazards: Record<typeof HAZARDS[number],number>; evidence: string; assessedAt: string };
export type SiteInput = { id?: string; version?: number; name: string; latitude: number; longitude: number; land: number; water: number; sanitation: number; shelter: number; occupied: number; hazard: number; verified: boolean; evidence: string; assessedAt: string };
export type CaseRecord = CaseInput & { id: string; version: number; createdAt: string; updatedAt: string };
export type SiteRecord = SiteInput & { id: string; version: number; createdAt: string; updatedAt: string };
export type PlanStatus = "Pending" | "Approved" | "Moving" | "Completed" | "Rejected" | "Cancelled";
export type Plan = { id: string; caseId: string; siteId: string; caseVersion: number; siteVersion: number; population: number; status: PlanStatus; createdAt: string; updatedAt: string; decisionSeconds?: number; caseSnapshot?: CaseRecord; siteSnapshot?: SiteRecord; note: string };
export type Audit = { id: string; actor: string; role: Role; action: string; target: string; at: string; note: string };
export type Snapshot = { actor: Actor | null; localAvailable: boolean; cases: CaseRecord[]; sites: SiteRecord[]; plans: Plan[]; audit: Audit[] };
export const reservedStatuses: PlanStatus[] = ["Approved","Moving","Completed"];
export function ageDays(date: string, now = Date.now()) { return (now-Date.parse(date))/86400000; }
export function fresh(date: string, now=Date.now()) { const age=ageDays(date,now); return Number.isFinite(age)&&age>=-1&&age<=30; }
export function risk(c: CaseInput) {
 const exposure=Math.max(...HAZARDS.map(h=>c.hazards[h]))/5*55;
 const vulnerability=c.population>0?c.vulnerable/c.population*30:0;
 const history=Math.min(c.history,5)/5*15;
 const score=Math.round(exposure+vulnerability+history);
 return { score, exposure, vulnerability, history, category:score>=76?"Critical":score>=51?"High":score>=26?"Moderate":"Safe", redZone:score>=76, confidence:fresh(c.assessedAt)?"Field evidence current":"Needs reassessment" };
}
export function distance(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) {
 const r=Math.PI/180,dlat=(b.latitude-a.latitude)*r,dlon=(b.longitude-a.longitude)*r;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlon/2)**2)));
}
export function capacity(s: SiteInput) { return Math.min(s.land,s.water,s.sanitation,s.shelter); }
export function candidates(c: CaseRecord,sites:SiteRecord[],plans:Plan[]) {
 return sites.map(s=>{
  const reserved=plans.filter(p=>p.siteId===s.id&&reservedStatuses.includes(p.status)).reduce((n,p)=>n+p.population,0);
  const available=Math.max(0,capacity(s)-s.occupied-reserved);
  const reasons:string[]=[];
  if(!fresh(c.assessedAt)) reasons.push("Habitation assessment is older than 30 days");
  if(!s.verified)reasons.push("Safety and access have not been field-verified");
  if(!fresh(s.assessedAt))reasons.push("Site assessment is older than 30 days");
  if(s.hazard>1)reasons.push("Site hazard exceeds the prototype screening limit (1/5)");
  if(available<c.population)reasons.push("Insufficient capacity for the full population");
  return {site:s,available,reserved,distance:distance(c,s),eligible:!reasons.length,reasons};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||a.distance-b.distance||a.site.id.localeCompare(b.site.id));
}
export function directions(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) {return "https://www.google.com/maps/dir/?"+new URLSearchParams({api:"1",origin:`${a.latitude},${a.longitude}`,destination:`${b.latitude},${b.longitude}`,travelmode:"driving"});}
