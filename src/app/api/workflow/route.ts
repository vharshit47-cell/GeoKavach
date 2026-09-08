import { cookies } from "next/headers";
import { getVerifiedUser } from "@/backend/supabase/server";
import { privateJson } from "@/backend/supabase/http";
import { readBoundedJson,requireSameOrigin,RequestError,clientBucket,rateLimit } from "@/backend/services/request-guard";
import { workflowStore } from "@/backend/workflow/store";
import { WorkflowError } from "@/backend/workflow/validation";
import type {Actor,Role} from "@/shared/workflow/model";
export const runtime="nodejs";
function localAvailable(request:Request){const host=new URL(request.url).hostname;return process.env.NODE_ENV==="development"&&["localhost","127.0.0.1","[::1]"].includes(host);}
async function identity(request:Request):Promise<Actor|null>{
 if(localAvailable(request)){const token=(await cookies()).get("relocation-session")?.value;if(token){const actor=workflowStore().getSession(token);if(actor)return actor;}}
 const {user}=await getVerifiedUser();if(!user)return null;
 const role=user.app_metadata?.workflow_role,workspace=user.app_metadata?.workflow_workspace;
 return ["officer","administrator","coordinator"].includes(role)&&typeof workspace==="string"&&workspace.length>0?{id:user.id,role,workspace:`official:${workspace}`,local:false}:null;
}
export async function GET(request:Request){try{const actor=await identity(request);return privateJson({actor,localAvailable:localAvailable(request),...(actor?workflowStore().snapshot(actor):{cases:[],sites:[],plans:[],audit:[]})});}catch{return privateJson({error:"Workflow storage unavailable. Your unsent draft is unchanged."},503);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);
 if(!rateLimit(`workflow:${clientBucket(request)}`,60,60000).allowed)return privateJson({error:"Too many requests. Retry shortly."},429);
 const body=await readBoundedJson(request) as Record<string,unknown>;
 if(!body||typeof body!=="object"||Array.isArray(body))throw new WorkflowError("Invalid request");
 if(body.action==="session"){
 if(!localAvailable(request))throw new WorkflowError("Prototype role sessions are available only on the local development server",403);
 if(!["officer","administrator","coordinator"].includes(String(body.role)))throw new WorkflowError("Invalid role");
 const token=workflowStore().session(body.role as Role);const response=privateJson({ok:true});response.cookies.set("relocation-session",token,{httpOnly:true,sameSite:"strict",path:"/api/workflow",maxAge:8*3600});return response;
 }
 const actor=await identity(request);if(!actor)throw new WorkflowError("Sign in with an assigned workflow role or start a local prototype session",401);
 return privateJson({actor,localAvailable:localAvailable(request),...workflowStore().mutate(actor,body)});
 }catch(error){if(error instanceof WorkflowError||error instanceof RequestError)return privateJson({error:error.message},error.status);console.error("Relocation workflow operation failed");return privateJson({error:"Could not save. Refresh to check the current status before retrying."},503);}}
