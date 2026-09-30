import { NextRequest } from "next/server";
import { z } from "zod";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { WorkflowsRepo } from "@/lib/db/repos";
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

    const result = await workflowsRepo.list(ctx.workspaceId, {
      cursor,
      limit,
    });

    return jsonResponse(result, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
