import "server-only";
import { cookies } from "next/headers";
import { getVerifiedUser } from "@/backend/supabase/server";
import type { Actor } from "@/shared/workflow/model";
import { workflowStore } from "./store";

export function localWorkflowAvailable(request: Request) {
  const host = new URL(request.url).hostname;
  return process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(host);
}

export async function workflowIdentity(request: Request): Promise<Actor | null> {
  if (localWorkflowAvailable(request)) {
    const token = (await cookies()).get("relocation-session")?.value;
    if (token) {
      const actor = workflowStore().getSession(token);
      if (actor) return actor;
    }
  }
  const { user } = await getVerifiedUser();
  if (!user) return null;
  const role = user.app_metadata?.workflow_role;
  const workspace = user.app_metadata?.workflow_workspace;
  return ["officer", "administrator", "coordinator"].includes(role) && typeof workspace === "string" && workspace.length > 0
    ? { id: user.id, role, workspace: `official:${workspace}`, local: false }
    : null;
}
