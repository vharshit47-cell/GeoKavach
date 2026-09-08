import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { candidates, capacity, reservedStatuses, type Actor, type CaseRecord, type SiteRecord, type Plan, type Audit, type Role } from "../../shared/workflow/model";
import { parseCase,parseSite,WorkflowError } from "./validation";
export class WorkflowStore {
 private db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS records(workspace TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(workspace,kind,id));
 CREATE TABLE IF NOT EXISTS requests(workspace TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(workspace,id));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,role TEXT NOT NULL,expires INTEGER NOT NULL);
 `);}
 close(){this.db.close();}
 records<T>(workspace:string,kind:string):T[]{return (this.db.prepare("SELECT data FROM records WHERE workspace=? AND kind=? ORDER BY rowid").all(workspace,kind) as {data:string}[]).map(r=>JSON.parse(r.data));}
 private put(workspace:string,kind:string,data:{id:string}){this.db.prepare("INSERT INTO records(workspace,kind,id,data) VALUES(?,?,?,?) ON CONFLICT(workspace,kind,id) DO UPDATE SET data=excluded.data").run(workspace,kind,data.id,JSON.stringify(data));}
 snapshot(actor:Actor){return {cases:this.records<CaseRecord>(actor.workspace,"case"),sites:this.records<SiteRecord>(actor.workspace,"site"),plans:this.records<Plan>(actor.workspace,"plan"),audit:this.records<Audit>(actor.workspace,"audit").slice(-200).reverse()};}
 session(role:Role){const token=randomUUID();this.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());this.db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(token,role,Date.now()+8*3600000);return token;}
 getSession(token:string):Actor|null{const r=this.db.prepare("SELECT role FROM sessions WHERE token=? AND expires>?").get(token,Date.now()) as {role:Role}|undefined;return r?{id:`local-${r.role}`,role:r.role,workspace:"local-prototype",local:true}:null;}
 mutate(actor:Actor,body:Record<string,unknown>){
 this.db.exec("BEGIN IMMEDIATE");
 try{
 const requestId=typeof body.requestId==="string"?body.requestId:null;
 const hash=createHash("sha256").update(JSON.stringify({...body,actor:actor.id})).digest("hex");
 if(requestId){const prior=this.db.prepare("SELECT hash FROM requests WHERE workspace=? AND id=?").get(actor.workspace,requestId) as {hash:string}|undefined;if(prior){if(prior.hash!==hash)throw new WorkflowError("Request key was reused for a different operation",409);this.db.exec("COMMIT");return this.snapshot(actor);}}
 const now=new Date().toISOString(),snapshot=this.snapshot(actor);let target="";
 const note=typeof body.note==="string"?body.note.trim().slice(0,1000):"";
 const requireRole=(role:Role)=>{if(actor.role!==role)throw new WorkflowError(`Only the ${role} can perform this action`,403);};
 if(body.action==="saveCase"||body.action==="saveSite"){
 requireRole("officer");const kind=body.action==="saveCase"?"case":"site";
 const input=kind==="case"?parseCase(body.input):parseSite(body.input);
 const current=(kind==="case"?snapshot.cases:snapshot.sites).find(r=>r.id===input.id);
 if(input.id&&(!current||current.version!==input.version))throw new WorkflowError("This record changed. Refresh and review before saving.",409);
 if(current&&kind==="case"&&snapshot.plans.some(p=>p.caseId===current.id&&reservedStatuses.includes(p.status)))throw new WorkflowError("Cancel the active plan before changing its habitation assessment",409);
 if(kind==="site"&&current){const s=input as ReturnType<typeof parseSite>;const reserved=snapshot.plans.filter(p=>p.siteId===current.id&&reservedStatuses.includes(p.status)).reduce((n,p)=>n+p.population,0);if(capacity(s)-s.occupied<reserved)throw new WorkflowError("Capacity cannot be reduced below committed people. Review the existing plans first.",409);}
 const record={...input,id:current?.id??randomUUID(),version:(current?.version??0)+1,createdAt:current?.createdAt??now,updatedAt:now};target=record.id;this.put(actor.workspace,kind,record);
 }else if(body.action==="propose"){
 requireRole("officer");const c=snapshot.cases.find(c=>c.id===body.caseId);if(!c)throw new WorkflowError("Select a saved habitation");
 if(snapshot.plans.some(p=>p.caseId===c.id&&!["Rejected","Cancelled"].includes(p.status)))throw new WorkflowError("This habitation already has a pending or committed plan",409);
 const match=candidates(c,snapshot.sites,snapshot.plans).find(r=>r.site.id===body.siteId);if(!match?.eligible)throw new WorkflowError(match?.reasons.join("; ")||"Select an eligible site",409);
 const plan:Plan={id:randomUUID(),caseId:c.id,siteId:match.site.id,caseVersion:c.version,siteVersion:match.site.version,population:c.population,caseSnapshot:c,siteSnapshot:match.site,status:"Pending",createdAt:now,updatedAt:now,note};target=plan.id;this.put(actor.workspace,"plan",plan);
 }else if(body.action==="transition"){
 const plan=snapshot.plans.find(p=>p.id===body.id);if(!plan)throw new WorkflowError("Plan not found",404);
 const status=String(body.status) as Plan["status"];
 const allowed:Record<string,string[]>={Pending:["Approved","Rejected","Cancelled"],Approved:["Moving","Cancelled"],Moving:["Completed","Cancelled"]};
 if(!allowed[plan.status]?.includes(status))throw new WorkflowError("Invalid or already applied status transition",409);
 requireRole(status==="Moving"||status==="Completed"?"coordinator":"administrator");
 if(note.length<10)throw new WorkflowError("Add a decision or progress note (at least 10 characters)");
 if(status==="Approved"||status==="Moving"){
 const c=snapshot.cases.find(c=>c.id===plan.caseId),s=snapshot.sites.find(s=>s.id===plan.siteId);
 if(!c||!s)throw new WorkflowError("Assessment missing",409);
 if(c.version!==plan.caseVersion||s.version!==plan.siteVersion)throw new WorkflowError("Assessment changed. Cancel and submit a new plan for review.",409);
 const match=candidates(c,[s],snapshot.plans.filter(p=>p.id!==plan.id))[0];if(!match.eligible)throw new WorkflowError(match.reasons.join("; "),409);
 }
 if(status==="Cancelled"&&plan.status==="Moving")throw new WorkflowError("People are already moving. Record completion; do not release occupied capacity automatically.",409);
 const updated={...plan,status,updatedAt:now,note,...(status==="Approved"?{decisionSeconds:Math.round((Date.now()-Date.parse(plan.createdAt))/1000)}:{})};target=plan.id;this.put(actor.workspace,"plan",updated);
 }else throw new WorkflowError("Unknown workflow action");
 this.put(actor.workspace,"audit",{id:randomUUID(),actor:actor.id,role:actor.role,action:String(body.action)+(body.status?`:${body.status}`:""),target,at:now,note} as Audit);
 if(requestId)this.db.prepare("INSERT INTO requests VALUES(?,?,?)").run(actor.workspace,requestId,hash);
 this.db.exec("COMMIT");return this.snapshot(actor);
 }catch(error){this.db.exec("ROLLBACK");throw error;}
 }
}
let store:WorkflowStore|undefined;
export function workflowStore(){if(!store){const folder=join(process.cwd(),".local");mkdirSync(folder,{recursive:true});store=new WorkflowStore(join(folder,"relocation.sqlite"));}return store;}
