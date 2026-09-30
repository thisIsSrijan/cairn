import { describe, it, expect } from "vitest";
import {
  workflowSchema,
  runSchema,
  sourceSchema,
  recordSchema,
  runEventSchema,
  exportFileSchema,
} from "@/lib/db/schemas";

describe("Database Zod Schemas", () => {
  describe("Workflow schema", () => {
    const validWorkflow = {
      workspaceId: "ws_test_123",
      title: "AI Engineer Job Openings",
      prompt: "Find AI engineer jobs in Berlin with salary ranges",
      blueprint: {
        intent: "Collect AI engineering vacancies with compensation",
        entity: "JobOpening",
        fields: [
          {
            key: "title",
            label: "Role Title",
            type: "string",
            required: true,
            description: "Job title as posted",
          },
          {
            key: "salaryMin",
            label: "Minimum Salary",
            type: "number",
            required: false,
            description: "Annual base salary floor",
          },
          {
            key: "applyUrl",
            label: "Application URL",
            type: "url",
            required: true,
            description: "Direct job link",
          },
        ],
        keyFields: ["title", "applyUrl"],
        sources: [
          { kind: "search", query: "AI engineer jobs Berlin site:greenhouse.io" },
          { kind: "url", url: "https://example.com/careers" },
        ],
        limits: {
          maxSources: 10,
          maxRecords: 50,
        },
      },
      status: "ready",
      latestRunId: null,
      createdAt: new Date("2026-03-30T10:00:00Z"),
      updatedAt: new Date("2026-03-30T10:00:00Z"),
    };

    it("accepts a well-formed workflow definition", () => {
      const parsed = workflowSchema.parse(validWorkflow);
      expect(parsed.workspaceId).toBe("ws_test_123");
      expect(parsed.blueprint.fields).toHaveLength(3);
      expect(parsed.blueprint.limits.maxRecords).toBe(50);
    });

    it("rejects an empty workspace ID", () => {
      const invalid = { ...validWorkflow, workspaceId: "" };
      expect(() => workflowSchema.parse(invalid)).toThrow();
    });

    it("rejects blueprint fields with unrecognized types", () => {
      const invalid = {
        ...validWorkflow,
        blueprint: {
          ...validWorkflow.blueprint,
          fields: [
            {
              key: "title",
              label: "Role",
              type: "unsupported-type",
              required: true,
              description: "test",
            },
          ],
        },
      };
      expect(() => workflowSchema.parse(invalid)).toThrow();
    });

    it("rejects negative limits", () => {
      const invalid = {
        ...validWorkflow,
        blueprint: {
          ...validWorkflow.blueprint,
          limits: { maxSources: -5, maxRecords: 50 },
        },
      };
      expect(() => workflowSchema.parse(invalid)).toThrow();
    });
  });

  describe("Run schema", () => {
    const validRun = {
      workflowId: "wf_123",
      workspaceId: "ws_test_123",
      status: "planning",
      stage: "planning",
      cursor: { page: 1 },
      counts: {
        sourcesFound: 5,
        sourcesFetched: 3,
        valuesExtracted: 12,
        valuesRejected: 2,
        recordsKept: 6,
        duplicatesMerged: 1,
        verified: 10,
        unverified: 2,
      },
      error: null,
      startedAt: new Date("2026-03-30T10:05:00Z"),
      finishedAt: null,
      previousRunId: null,
      createdAt: new Date("2026-03-30T10:05:00Z"),
    };

    it("accepts valid run state machine document", () => {
      const parsed = runSchema.parse(validRun);
      expect(parsed.status).toBe("planning");
      expect(parsed.counts.sourcesFound).toBe(5);
    });

    it("accepts all valid state machine statuses", () => {
      const statuses = [
        "queued",
        "planning",
        "discovering",
        "fetching",
        "extracting",
        "validating",
        "deduping",
        "verifying",
        "complete",
        "failed",
        "cancelled",
        "paused",
      ] as const;

      for (const status of statuses) {
        const parsed = runSchema.parse({ ...validRun, status });
        expect(parsed.status).toBe(status);
      }
    });

    it("rejects unknown statuses", () => {
      expect(() =>
        runSchema.parse({ ...validRun, status: "idle" })
      ).toThrow();
    });

    it("provides default count metrics when omitted", () => {
      const minimalRun = {
        workflowId: "wf_123",
        workspaceId: "ws_test_123",
        stage: "queued",
      };
      const parsed = runSchema.parse(minimalRun);
      expect(parsed.counts.sourcesFound).toBe(0);
      expect(parsed.counts.recordsKept).toBe(0);
      expect(parsed.cursor).toEqual({});
      expect(parsed.createdAt).toBeInstanceOf(Date);
    });

    it("evaluates default timestamps when dates are omitted across all schemas", () => {
      const wf = workflowSchema.parse({
        workspaceId: "ws_test",
        title: "Test WF",
        prompt: "Prompt",
        blueprint: {
          intent: "Intent",
          entity: "Entity",
          fields: [{ key: "k", label: "L", type: "string", required: true, description: "" }],
          keyFields: ["k"],
          sources: [{ kind: "search", query: "q" }],
          limits: { maxSources: 1, maxRecords: 1 },
        },
      });
      expect(wf.createdAt).toBeInstanceOf(Date);
      expect(wf.updatedAt).toBeInstanceOf(Date);

      const src = sourceSchema.parse({
        workspaceId: "ws_test",
        runId: "run_1",
        url: "https://example.com",
        domain: "example.com",
        discoveredVia: "search",
        robots: { allowed: true, checkedAt: new Date() },
      });
      expect(src.createdAt).toBeInstanceOf(Date);

      const rec = recordSchema.parse({
        workspaceId: "ws_test",
        runId: "run_1",
        workflowId: "wf_1",
        fingerprint: "fp_1",
        values: { a: 1 },
      });
      expect(rec.createdAt).toBeInstanceOf(Date);
      expect(rec.flags).toEqual([]);
      expect(rec.mergedFrom).toEqual([]);

      const evt = runEventSchema.parse({
        workspaceId: "ws_test",
        runId: "run_1",
        stage: "discovering",
        message: "hello",
      });
      expect(evt.ts).toBeInstanceOf(Date);
      expect(evt.createdAt).toBeInstanceOf(Date);

      const exp = exportFileSchema.parse({
        workspaceId: "ws_test",
        runId: "run_1",
        format: "json",
        url: "https://example.com/file.json",
        rows: 5,
      });
      expect(exp.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("Source schema", () => {
    const validSource = {
      workspaceId: "ws_test_123",
      runId: "run_456",
      url: "https://greenhouse.io/acme/jobs/101",
      domain: "greenhouse.io",
      title: "Staff Systems Engineer",
      discoveredVia: "search query: AI engineer jobs Berlin",
      robots: {
        allowed: true,
        checkedAt: new Date("2026-03-30T10:06:00Z"),
      },
      httpStatus: 200,
      fetchedAt: new Date("2026-03-30T10:06:05Z"),
      contentHash: "sha256-abcdef123456",
      textLength: 4096,
      snapshot: {
        publicId: "cairn/snapshots/run_456_s1",
        url: "https://res.cloudinary.com/demo/raw/upload/run_456_s1.html",
      },
      status: "fetched",
      createdAt: new Date("2026-03-30T10:06:00Z"),
    };

    it("accepts valid source document", () => {
      const parsed = sourceSchema.parse(validSource);
      expect(parsed.domain).toBe("greenhouse.io");
      expect(parsed.robots.allowed).toBe(true);
    });

    it("rejects invalid URLs", () => {
      expect(() =>
        sourceSchema.parse({ ...validSource, url: "not-a-valid-url" })
      ).toThrow();
    });

    it("accepts permitted source statuses", () => {
      const statuses = ["pending", "fetched", "failed", "blocked", "skipped"] as const;
      for (const status of statuses) {
        const parsed = sourceSchema.parse({ ...validSource, status });
        expect(parsed.status).toBe(status);
      }
    });
  });

  describe("Record schema with receipts", () => {
    const validRecord = {
      workspaceId: "ws_test_123",
      runId: "run_456",
      workflowId: "wf_123",
      fingerprint: "sha256-role-hash-abc",
      values: {
        title: "Staff Systems Engineer",
        salaryMin: 95000,
        applyUrl: "https://greenhouse.io/acme/jobs/101",
      },
      receipts: {
        title: {
          sourceId: "src_789",
          evidence: "We are seeking a Staff Systems Engineer to lead core infrastructure",
          confidence: 0.98,
          extractedAt: new Date("2026-03-30T10:07:00Z"),
          validator: {
            status: "verified",
            notes: "Exact verbatim match against HTML snapshot",
          },
        },
      },
      rowConfidence: 0.95,
      flags: [],
      mergedFrom: [],
      createdAt: new Date("2026-03-30T10:07:00Z"),
    };

    it("accepts record with verbatim receipt evidence", () => {
      const parsed = recordSchema.parse(validRecord);
      expect(parsed.receipts.title?.validator.status).toBe("verified");
      expect(parsed.receipts.title?.confidence).toBe(0.98);
    });

    it("rejects confidence numbers outside 0 to 1 range", () => {
      const invalid = {
        ...validRecord,
        rowConfidence: 1.5,
      };
      expect(() => recordSchema.parse(invalid)).toThrow();

      const invalidReceipt = {
        ...validRecord,
        receipts: {
          ...validRecord.receipts,
          title: {
            ...validRecord.receipts.title,
            confidence: -0.1,
          },
        },
      };
      expect(() => recordSchema.parse(invalidReceipt)).toThrow();
    });

    it("rejects unknown receipt validator status", () => {
      const invalid = {
        ...validRecord,
        receipts: {
          ...validRecord.receipts,
          title: {
            ...validRecord.receipts.title,
            validator: {
              status: "dubious",
              notes: null,
            },
          },
        },
      };
      expect(() => recordSchema.parse(invalid)).toThrow();
    });
  });

  describe("RunEvent schema", () => {
    it("validates run event with log levels", () => {
      const event = {
        workspaceId: "ws_test_123",
        runId: "run_456",
        ts: new Date("2026-03-30T10:08:00Z"),
        level: "info",
        stage: "discovering",
        message: "Discovered 5 candidate URLs via seed query",
        meta: { found: 5 },
        createdAt: new Date("2026-03-30T10:08:00Z"),
      };
      const parsed = runEventSchema.parse(event);
      expect(parsed.level).toBe("info");
    });

    it("rejects invalid log level", () => {
      const invalid = {
        workspaceId: "ws_test_123",
        runId: "run_456",
        ts: new Date(),
        level: "critical",
        stage: "planning",
        message: "test",
        createdAt: new Date(),
      };
      expect(() => runEventSchema.parse(invalid)).toThrow();
    });
  });

  describe("ExportFile schema", () => {
    it("validates export file records", () => {
      const exportFile = {
        workspaceId: "ws_test_123",
        runId: "run_456",
        format: "csv",
        url: "https://res.cloudinary.com/demo/raw/upload/export_123.csv",
        rows: 42,
        createdAt: new Date("2026-03-30T10:10:00Z"),
      };
      const parsed = exportFileSchema.parse(exportFile);
      expect(parsed.format).toBe("csv");
      expect(parsed.rows).toBe(42);
    });

    it("rejects unsupported export formats", () => {
      const invalid = {
        workspaceId: "ws_test_123",
        runId: "run_456",
        format: "pdf",
        url: "https://example.com/file.pdf",
        rows: 10,
        createdAt: new Date(),
      };
      expect(() => exportFileSchema.parse(invalid)).toThrow();
    });
  });
});
