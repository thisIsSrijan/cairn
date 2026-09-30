import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import type { ExportFormat, RecordDoc, Source } from "@/lib/db/schemas";

export interface BuildExportParams {
  format: ExportFormat;
  records: Array<RecordDoc & { id: string }>;
  sources: Array<Source & { id: string }>;
  fields?: string[];
  filename?: string;
}

export interface BuiltExport {
  buffer: Buffer;
  rows: number;
  mimeType: string;
  filename: string;
}

export async function buildExportData(params: BuildExportParams): Promise<BuiltExport> {
  const { format, records, sources } = params;

  // Build source url map: sourceId -> url
  const sourceMap = new Map<string, string>();
  for (const src of sources) {
    sourceMap.set(src.id, src.url);
  }

  // Derive field list if not provided
  let fields = params.fields;
  if (!fields || fields.length === 0) {
    const keySet = new Set<string>();
    for (const record of records) {
      if (record.values && typeof record.values === "object") {
        for (const k of Object.keys(record.values)) {
          keySet.add(k);
        }
      }
    }
    fields = Array.from(keySet);
  }

  // Ordered columns: field followed by field__source
  const columns: string[] = [];
  for (const f of fields) {
    columns.push(f);
    columns.push(`${f}__source`);
  }

  // Generate rows
  const rows = records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const f of fields!) {
      row[f] = record.values[f] ?? null;
      const receipt = record.receipts?.[f];
      const sourceUrl = receipt?.sourceId ? sourceMap.get(receipt.sourceId) || "" : "";
      row[`${f}__source`] = sourceUrl;
    }
    return row;
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "json") {
    const jsonString = JSON.stringify(rows, null, 2);
    const buffer = Buffer.from(jsonString, "utf-8");
    return {
      buffer,
      rows: records.length,
      mimeType: "application/json",
      filename: params.filename || `export-${timestamp}.json`,
    };
  }

  if (format === "csv") {
    const csvContent = stringify(rows, {
      header: true,
      columns,
    });
    const buffer = Buffer.from(csvContent, "utf-8");
    return {
      buffer,
      rows: records.length,
      mimeType: "text/csv",
      filename: params.filename || `export-${timestamp}.csv`,
    };
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Records");
    worksheet.columns = columns.map((col) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 4, 15),
    }));

    for (const row of rows) {
      worksheet.addRow(row);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      buffer,
      rows: records.length,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: params.filename || `export-${timestamp}.xlsx`,
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}
