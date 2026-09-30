import { NextRequest } from "next/server";
import { z } from "zod";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RunsRepo, WorkflowsRepo, RecordsRepo, SourcesRepo, ExportsRepo } from "@/lib/db/repos";
import { exportFormatSchema } from "@/lib/db/schemas";
import { buildExportData } from "@/lib/export/builder";
import { createExportStore } from "@/lib/export/store";

const exportRequestSchema = z.object({
  format: exportFormatSchema,
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const body = await req.json();
    const { format } = exportRequestSchema.parse(body);

    const db = await getDb();
    const runsRepo = new RunsRepo(db);
    const workflowsRepo = new WorkflowsRepo(db);
    const recordsRepo = new RecordsRepo(db);
    const sourcesRepo = new SourcesRepo(db);
    const exportsRepo = new ExportsRepo(db);

    const run = await runsRepo.findById(ctx.workspaceId, id);
    if (!run) {
      return errorResponse("NOT_FOUND", "Run not found", 404);
    }

    const workflow = await workflowsRepo.findById(ctx.workspaceId, run.workflowId);
    const recordsResult = await recordsRepo.list(ctx.workspaceId, {
      runId: id,
      limit: 10000,
    });
    const sourcesResult = await sourcesRepo.list(ctx.workspaceId, {
      runId: id,
      limit: 1000,
    });

    const fields = workflow?.blueprint?.fields?.map((f) => f.key) || [];

    const built = await buildExportData({
      format,
      records: recordsResult.items,
      sources: sourcesResult.items,
      fields,
    });

    const exportStore = createExportStore();
    const uploadResult = await exportStore.saveExport({
      workspaceId: ctx.workspaceId,
      runId: id,
      format,
      buffer: built.buffer,
      filename: built.filename,
      mimeType: built.mimeType,
      rows: built.rows,
    });

    const exportDoc = await exportsRepo.create(ctx.workspaceId, {
      runId: id,
      format,
      url: uploadResult.url,
      rows: built.rows,
    });

    return jsonResponse(
      {
        id: exportDoc.id,
        format: exportDoc.format,
        url: exportDoc.url,
        rows: exportDoc.rows,
      },
      ctx
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
