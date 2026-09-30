import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo, RecordsRepo } from "@/lib/db/repos";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const minConfidenceParam = searchParams.get("minConfidence");
    const minConfidence = minConfidenceParam ? parseFloat(minConfidenceParam) : undefined;
    const sort = searchParams.get("sort") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);
    const recordsRepo = new RecordsRepo(db);

    const run = await runsRepo.findById(ctx.workspaceId, id);
    if (!run) {
      return errorResponse("NOT_FOUND", "Run not found", 404);
    }

    const result = await recordsRepo.list(ctx.workspaceId, {
      runId: id,
      search: q,
      status,
      minConfidence,
      sort,
      cursor,
      limit,
    });

    return jsonResponse(result, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
