import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo, SourcesRepo } from "@/lib/db/repos";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);
    const sourcesRepo = new SourcesRepo(db);

    const run = await runsRepo.findById(ctx.workspaceId, id);
    if (!run) {
      return errorResponse("NOT_FOUND", "Run not found", 404);
    }

    const result = await sourcesRepo.list(ctx.workspaceId, {
      runId: id,
      limit: 100,
    });

    return jsonResponse(result, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
