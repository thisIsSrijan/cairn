import { NextRequest, NextResponse } from "next/server";
import { extractWorkspaceId } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { ExportsRepo } from "@/lib/db/repos";
import { getMemoryExportStore } from "@/lib/export/store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractWorkspaceId(req);
    const { id } = await context.params;

    const db = await getDb();
    const exportsRepo = new ExportsRepo(db);

    const exportDoc = await exportsRepo.findById(ctx.workspaceId, id);
    if (!exportDoc) {
      return errorResponse("NOT_FOUND", "Export file not found", 404);
    }

    if (exportDoc.url.startsWith("http://") || exportDoc.url.startsWith("https://")) {
      return NextResponse.redirect(exportDoc.url);
    }

    // Handle memory store downloads
    const memoryStore = getMemoryExportStore();
    const buffer = await memoryStore.getExport(exportDoc.url);

    if (!buffer) {
      return errorResponse("NOT_FOUND", "Export content not available in store", 404);
    }

    const mimeTypes: Record<string, string> = {
      csv: "text/csv; charset=utf-8",
      json: "application/json; charset=utf-8",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    const contentType = mimeTypes[exportDoc.format] || "application/octet-stream";
    const filename = `cairn-export-${id}.${exportDoc.format}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
