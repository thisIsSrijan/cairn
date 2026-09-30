import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { MemoryExportStore } from "@/lib/export/store";
import { buildExportData } from "@/lib/export/builder";
import type { RecordDoc, Source } from "@/lib/db/schemas";

describe("Export Module", () => {
  const mockSources: Array<Source & { id: string }> = [
    {
      id: "src_1",
      workspaceId: "ws_test",
      runId: "run_test",
      url: "https://example.com/jobs/page1",
      domain: "example.com",
      title: "Job Page 1",
      discoveredVia: "search",
      robots: { allowed: true, checkedAt: new Date() },
      httpStatus: 200,
      fetchedAt: new Date(),
      contentHash: "hash1",
      textLength: 100,
      snapshot: { publicId: "snap1", url: "https://res.cloudinary.com/demo/raw/upload/snap1" },
      status: "fetched",
      createdAt: new Date(),
    },
    {
      id: "src_2",
      workspaceId: "ws_test",
      runId: "run_test",
      url: "https://example.com/jobs/page2",
      domain: "example.com",
      title: "Job Page 2",
      discoveredVia: "search",
      robots: { allowed: true, checkedAt: new Date() },
      httpStatus: 200,
      fetchedAt: new Date(),
      contentHash: "hash2",
      textLength: 100,
      snapshot: { publicId: "snap2", url: "https://res.cloudinary.com/demo/raw/upload/snap2" },
      status: "fetched",
      createdAt: new Date(),
    },
  ];

  const mockRecords: Array<RecordDoc & { id: string }> = [
    {
      id: "rec_1",
      workspaceId: "ws_test",
      runId: "run_test",
      workflowId: "wf_test",
      fingerprint: "fp_1",
      values: {
        job_title: "Junior Developer",
        company_name: "Apex Software",
        salary: "$60,000",
      },
      receipts: {
        job_title: {
          sourceId: "src_1",
          evidence: "Junior Developer",
          confidence: 0.95,
          extractedAt: new Date(),
          validator: { status: "verified", notes: null },
        },
        company_name: {
          sourceId: "src_1",
          evidence: "Apex Software",
          confidence: 0.92,
          extractedAt: new Date(),
          validator: { status: "verified", notes: null },
        },
        salary: {
          sourceId: "src_2",
          evidence: "$60,000",
          confidence: 0.88,
          extractedAt: new Date(),
          validator: { status: "verified", notes: null },
        },
      },
      rowConfidence: 0.92,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
  ];

  const fields = ["job_title", "company_name", "salary"];

  it("builds JSON export with source url columns", async () => {
    const result = await buildExportData({
      format: "json",
      records: mockRecords,
      sources: mockSources,
      fields,
    });

    expect(result.mimeType).toBe("application/json");
    expect(result.rows).toBe(1);

    const parsed = JSON.parse(result.buffer.toString("utf-8"));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);

    const row = parsed[0];
    expect(row.job_title).toBe("Junior Developer");
    expect(row.job_title__source).toBe("https://example.com/jobs/page1");
    expect(row.company_name).toBe("Apex Software");
    expect(row.company_name__source).toBe("https://example.com/jobs/page1");
    expect(row.salary).toBe("$60,000");
    expect(row.salary__source).toBe("https://example.com/jobs/page2");
  });

  it("builds CSV export with source url columns", async () => {
    const result = await buildExportData({
      format: "csv",
      records: mockRecords,
      sources: mockSources,
      fields,
    });

    expect(result.mimeType).toBe("text/csv");
    expect(result.rows).toBe(1);

    const text = result.buffer.toString("utf-8");
    const lines = text.trim().split("\n");
    expect(lines.length).toBe(2);

    const header = lines[0];
    expect(header).toContain("job_title");
    expect(header).toContain("job_title__source");
    expect(header).toContain("company_name");
    expect(header).toContain("company_name__source");
    expect(header).toContain("salary");
    expect(header).toContain("salary__source");

    const dataLine = lines[1];
    expect(dataLine).toContain("Junior Developer");
    expect(dataLine).toContain("https://example.com/jobs/page1");
    expect(dataLine).toContain("Apex Software");
    expect(dataLine).toContain("https://example.com/jobs/page2");
  });

  it("builds XLSX export with source url columns and readable worksheet", async () => {
    const result = await buildExportData({
      format: "xlsx",
      records: mockRecords,
      sources: mockSources,
      fields,
    });

    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.rows).toBe(1);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.getWorksheet(1);
    expect(worksheet).toBeDefined();

    const headers: string[] = [];
    worksheet!.getRow(1).eachCell((cell) => {
      headers.push(String(cell.value));
    });

    expect(headers).toEqual([
      "job_title",
      "job_title__source",
      "company_name",
      "company_name__source",
      "salary",
      "salary__source",
    ]);

    const rowValues: string[] = [];
    worksheet!.getRow(2).eachCell((cell) => {
      rowValues.push(String(cell.value));
    });

    expect(rowValues[0]).toBe("Junior Developer");
    expect(rowValues[1]).toBe("https://example.com/jobs/page1");
    expect(rowValues[2]).toBe("Apex Software");
    expect(rowValues[3]).toBe("https://example.com/jobs/page1");
    expect(rowValues[4]).toBe("$60,000");
    expect(rowValues[5]).toBe("https://example.com/jobs/page2");
  });

  it("saves and retrieves files via MemoryExportStore", async () => {
    const store = new MemoryExportStore();
    const buffer = Buffer.from("test-content", "utf-8");

    const result = await store.saveExport({
      workspaceId: "ws_test",
      runId: "run_test",
      format: "csv",
      buffer,
      filename: "export.csv",
      mimeType: "text/csv",
      rows: 1,
    });

    expect(result.url).toMatch(/^memory:\/\/cairn\/exports\/ws_test\/run_test\/export\.csv/);

    const retrieved = await store.getExport(result.url);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.toString("utf-8")).toBe("test-content");
  });
});
