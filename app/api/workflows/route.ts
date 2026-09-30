import { NextRequest } from "next/server";
import { z } from "zod";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { WorkflowsRepo, RunsRepo } from "@/lib/db/repos";
import { blueprintSchema } from "@/lib/db/schemas";

const createWorkflowSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  blueprint: blueprintSchema,
});

export async function POST(req: NextRequest) {
  try {
    const ctx = extractWorkspaceId(req);
    const body = await req.json();
    const { prompt, blueprint } = createWorkflowSchema.parse(body);

    const db = await getDb();
    const workflowsRepo = new WorkflowsRepo(db);

    const workflow = await workflowsRepo.create(ctx.workspaceId, {
      prompt,
      blueprint,
      status: "draft",
    });

    return jsonResponse(workflow, ctx, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = extractWorkspaceId(req);
    const { searchParams } = new URL(req.url);

    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const db = await getDb();
    const workflowsRepo = new WorkflowsRepo(db);
    const runsRepo = new RunsRepo(db);

    const result = await workflowsRepo.list(ctx.workspaceId, {
      cursor,
      limit,
    });

    // Enrich with latest run data and export count
    const enrichedItems = await Promise.all(
      result.items.map(async (wf) => {
        let latestRun = null;
        let exportCount = 0;
        if (wf.latestRunId) {
          latestRun = await runsRepo.findById(ctx.workspaceId, wf.latestRunId);
          exportCount = await db.collection("exports").countDocuments({
            workspaceId: ctx.workspaceId,
            runId: wf.latestRunId,
          });
        }
        return {
          ...wf,
          latestRun,
          exportCount,
        };
      })
    );

    return jsonResponse({ ...result, items: enrichedItems }, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
