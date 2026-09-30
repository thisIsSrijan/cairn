import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo } from "@/lib/db/repos";
import type { RunStatus } from "@/lib/db/schemas";

export async function GET(req: NextRequest) {
  try {
    const ctx = extractWorkspaceId(req);
    const { searchParams } = new URL(req.url);

    const workflowId = searchParams.get("workflowId") || undefined;
    const status = (searchParams.get("status") as RunStatus) || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);

    const result = await runsRepo.list(ctx.workspaceId, {
      workflowId,
      status,
      cursor,
      limit,
    });

    return jsonResponse(result, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
