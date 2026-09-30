import { NextRequest } from "next/server";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { RecordsRepo, SourcesRepo } from "@/lib/db/repos";
import { createSnapshotStore } from "@/lib/sources/snapshot";
import { locate } from "@/lib/sources/evidence";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; field: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id, field } = await context.params;

    const db = await getDb();
    const recordsRepo = new RecordsRepo(db);
    const sourcesRepo = new SourcesRepo(db);

    const record = await recordsRepo.findById(ctx.workspaceId, id);
    if (!record) {
      return errorResponse("NOT_FOUND", "Record not found", 404);
    }

    const receipt = record.receipts?.[field];
    if (!receipt) {
      return errorResponse("NOT_FOUND", `Receipt for field "${field}" not found`, 404);
    }

    const source = await sourcesRepo.findById(ctx.workspaceId, receipt.sourceId);
    if (!source) {
      return errorResponse("NOT_FOUND", "Associated source document not found", 404);
    }

    let location = null;
    let windowData = null;

    if (source.snapshot?.publicId) {
      const snapshotStore = createSnapshotStore();
      const snapshotText = await snapshotStore.getSnapshot(source.snapshot.publicId);

      if (snapshotText) {
        const loc = locate(snapshotText, receipt.evidence);
        if (loc) {
          const windowStart = Math.max(0, loc.start - 250);
          const windowEnd = Math.min(snapshotText.length, loc.end + 250);

          location = {
            start: loc.start,
            end: loc.end,
          };

          windowData = {
            prefix: snapshotText.slice(windowStart, loc.start),
            match: snapshotText.slice(loc.start, loc.end),
            suffix: snapshotText.slice(loc.end, windowEnd),
            text: snapshotText.slice(windowStart, windowEnd),
          };
        }
      }
    }

    return jsonResponse(
      {
        receipt,
        location,
        window: windowData,
        source: {
          id: source.id,
          url: source.url,
          domain: source.domain,
          title: source.title,
          fetchedAt: source.fetchedAt,
        },
      },
      ctx
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
