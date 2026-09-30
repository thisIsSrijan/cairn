import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { WorkflowsRepo, RunsRepo } from "@/lib/db/repos";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);

    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;
    const cursor = searchParams.get("cursor") || undefined;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);

    const result = await runsRepo.list(ctx.workspaceId, {
      workflowId: id,
      cursor,
      limit,
    });

    return jsonResponse(result, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const db = await getDb();
    const workflowsRepo = new WorkflowsRepo(db);
    const runsRepo = new RunsRepo(db);

    const workflow = await workflowsRepo.findById(ctx.workspaceId, id);
    if (!workflow) {
      return errorResponse("NOT_FOUND", "Workflow not found", 404);
    }

    // Previous run set to latest complete run
    const completeRuns = await runsRepo.list(ctx.workspaceId, {
      workflowId: id,
      status: "complete",
      limit: 1,
    });
    const previousRunId = completeRuns.items[0]?.id || null;

    const run = await runsRepo.create(ctx.workspaceId, {
      workflowId: id,
      status: "queued",
      stage: "planning",
      previousRunId,
    });

    return jsonResponse(run, ctx, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
