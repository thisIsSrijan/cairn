import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo, EventsRepo } from "@/lib/db/repos";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after") || undefined;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);
    const eventsRepo = new EventsRepo(db);

    const run = await runsRepo.findById(ctx.workspaceId, id);
    if (!run) {
      return errorResponse("NOT_FOUND", "Run not found", 404);
    }

    const eventsResult = await eventsRepo.list(ctx.workspaceId, {
      runId: id,
      after,
      limit: 100,
    });

    return jsonResponse(
      {
        run,
        counts: run.counts,
        events: eventsResult.items,
        nextCursor: eventsResult.nextCursor,
      },
      ctx
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
