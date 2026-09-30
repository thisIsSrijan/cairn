import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { WorkflowsRepo } from "@/lib/db/repos";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const db = await getDb();
    const workflowsRepo = new WorkflowsRepo(db);

    const workflow = await workflowsRepo.findById(ctx.workspaceId, id);
    if (!workflow) {
      return errorResponse("NOT_FOUND", "Workflow not found", 404);
    }

    return jsonResponse(workflow, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
