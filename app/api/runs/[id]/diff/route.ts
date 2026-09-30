import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo, RecordsRepo } from "@/lib/db/repos";
import type { RecordDoc } from "@/lib/db/schemas";
import { computeRunDiff } from "@/lib/pipeline/diff";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);
    const recordsRepo = new RecordsRepo(db);

    const run = await runsRepo.findById(ctx.workspaceId, id);
    if (!run) {
      return errorResponse("NOT_FOUND", "Run not found", 404);
    }

    const currentRecordsResult = await recordsRepo.list(ctx.workspaceId, {
      runId: id,
      limit: 1000,
    });

    let previousRecords: Array<RecordDoc & { id: string }> = [];
    if (run.previousRunId) {
      const prevResult = await recordsRepo.list(ctx.workspaceId, {
        runId: run.previousRunId,
        limit: 1000,
      });
      previousRecords = prevResult.items;
    }

    const diff = computeRunDiff(run, currentRecordsResult.items, previousRecords);
    return jsonResponse(diff, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
