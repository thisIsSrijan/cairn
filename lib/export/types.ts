import type { ExportFormat } from "@/lib/db/schemas";

export interface SaveExportParams {
  workspaceId: string;
  runId: string;
  format: ExportFormat;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  rows: number;
}

export interface ExportResult {
  url: string;
  publicId?: string;
  format: ExportFormat;
  rows: number;
}

export interface ExportStore {
  saveExport(params: SaveExportParams): Promise<ExportResult>;
  getExport(urlOrId: string): Promise<Buffer | null>;
}
