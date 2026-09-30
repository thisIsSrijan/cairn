import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo } from "@/lib/db/repos";
import { resumeRun } from "@/lib/pipeline/engine";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const db = await getDb();
    const runsRepo = new RunsRepo(db);

    const existingRun = await runsRepo.findById(ctx.workspaceId, id);
    if (!existingRun) {
      return errorResponse("NOT_FOUND", "Run not found", 404);
    }

    const updated = await resumeRun(id, ctx.workspaceId, { db });
    return jsonResponse(updated, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
