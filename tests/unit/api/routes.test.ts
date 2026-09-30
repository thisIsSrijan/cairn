import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createTestDatabase, type TestDatabaseContext } from "@/tests/fixtures/test-db";
import { ensureIndexes } from "@/lib/db/indexes";
import {
  WorkflowsRepo,
  RunsRepo,
  RecordsRepo,
  SourcesRepo,
  EventsRepo,
  ExportsRepo,
} from "@/lib/db/repos";
import { WORKSPACE_COOKIE_NAME } from "@/lib/workspace";
import { resetRateLimiter } from "@/lib/api/rateLimit";
import { createExportStore } from "@/lib/export/store";

// Route handler imports
import { POST as handlePostBlueprint } from "@/app/api/blueprints/route";
import { POST as handlePostWorkflow, GET as handleGetWorkflows } from "@/app/api/workflows/route";
import { GET as handleGetWorkflowById } from "@/app/api/workflows/[id]/route";
import { POST as handlePostRun } from "@/app/api/workflows/[id]/runs/route";
import { GET as handleGetRunById } from "@/app/api/runs/[id]/route";
import { POST as handleAdvanceRun } from "@/app/api/runs/[id]/advance/route";
import { POST as handlePauseRun } from "@/app/api/runs/[id]/pause/route";
import { POST as handleResumeRun } from "@/app/api/runs/[id]/resume/route";
import { POST as handleCancelRun } from "@/app/api/runs/[id]/cancel/route";
import { GET as handleGetRunRecords } from "@/app/api/runs/[id]/records/route";
import { GET as handleGetReceipt } from "@/app/api/records/[id]/receipts/[field]/route";
import { GET as handleGetRunSources } from "@/app/api/runs/[id]/sources/route";
import { GET as handleGetRunDiff } from "@/app/api/runs/[id]/diff/route";
import { POST as handleExportRun } from "@/app/api/runs/[id]/export/route";
import { GET as handleDemoRun } from "@/app/api/demo/run/route";

function makeJsonRequest(url: string, method: string, body?: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (cookie) {
    headers.set("Cookie", `${WORKSPACE_COOKIE_NAME}=${cookie}`);
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(new Request(url, init));
}

function makeGetRequest(url: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) {
    headers.set("Cookie", `${WORKSPACE_COOKIE_NAME}=${cookie}`);
  }
  return new NextRequest(new Request(url, { method: "GET", headers }));
}

describe("HTTP Route Handlers", () => {
  let testDb: TestDatabaseContext;
  let workflowsRepo: WorkflowsRepo;
  let runsRepo: RunsRepo;
  let recordsRepo: RecordsRepo;
  let sourcesRepo: SourcesRepo;
  let eventsRepo: EventsRepo;
  let exportsRepo: ExportsRepo;

  const wsA = "ws_user_alpha";
  const wsB = "ws_user_beta";

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.MONGODB_URI = testDb.uri;
    process.env.MONGODB_DB = testDb.db.databaseName;
    process.env.DEMO_MODE = "true";
    await ensureIndexes(testDb.db);

    workflowsRepo = new WorkflowsRepo(testDb.db);
    runsRepo = new RunsRepo(testDb.db);
    recordsRepo = new RecordsRepo(testDb.db);
    sourcesRepo = new SourcesRepo(testDb.db);
    eventsRepo = new EventsRepo(testDb.db);
    exportsRepo = new ExportsRepo(testDb.db);
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.cleanAll();
    resetRateLimiter();
  });

  describe("POST /api/blueprints", () => {
    it("returns a Blueprint for a valid request and sets workspace cookie if new", async () => {
      const req = makeJsonRequest("http://localhost:3000/api/blueprints", "POST", {
        prompt: "job openings for junior developers in Lucknow",
      });

      const res = await handlePostBlueprint(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.entity).toBe("JobOpening");
      expect(data.fields.length).toBeGreaterThan(0);

      const cookieHeader = res.headers.get("set-cookie");
      expect(cookieHeader).toContain(WORKSPACE_COOKIE_NAME);
    });

    it("returns a PlannerRefusal for PII requests", async () => {
      const req = makeJsonRequest(
        "http://localhost:3000/api/blueprints",
        "POST",
        {
          prompt: "Find personal phone numbers and home addresses of employees",
        },
        wsA
      );

      const res = await handlePostBlueprint(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.refusal).toBeDefined();
      expect(data.refusal.reason).toContain("personal contact");
    });

    it("returns 400 validation error for missing or empty prompt", async () => {
      const req = makeJsonRequest("http://localhost:3000/api/blueprints", "POST", {}, wsA);
      const res = await handlePostBlueprint(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("enforces rate limits on the blueprints endpoint", async () => {
      let lastStatus = 200;
      for (let i = 0; i < 20; i++) {
        const req = makeJsonRequest(
          "http://localhost:3000/api/blueprints",
          "POST",
          {
            prompt: "job openings for junior developers in Lucknow",
          },
          wsA
        );
        const res = await handlePostBlueprint(req);
        lastStatus = res.status;
        if (lastStatus === 429) break;
      }

      expect(lastStatus).toBe(429);
    });
  });

  describe("Workflows and Runs Lifecycle", () => {
    const validBlueprint = {
      intent: "Discover open junior developer roles",
      entity: "JobOpening",
      fields: [
        { key: "job_title", label: "Job Title", type: "string" as const, required: true, description: "" },
        { key: "company_name", label: "Company Name", type: "string" as const, required: true, description: "" },
        { key: "salary", label: "Salary", type: "string" as const, required: false, description: "" },
      ],
      keyFields: ["job_title", "company_name"],
      sources: [{ kind: "search" as const, query: "junior dev jobs" }],
      limits: { maxSources: 5, maxRecords: 20 },
    };

    it("creates workflow and lists workflows scoped by workspace", async () => {
      const postReq = makeJsonRequest(
        "http://localhost:3000/api/workflows",
        "POST",
        {
          prompt: "Junior dev jobs in Lucknow",
          blueprint: validBlueprint,
        },
        wsA
      );

      const createRes = await handlePostWorkflow(postReq);
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.id).toBeDefined();
      expect(created.prompt).toBe("Junior dev jobs in Lucknow");

      // GET /api/workflows
      const listReq = makeGetRequest("http://localhost:3000/api/workflows", wsA);
      const listRes = await handleGetWorkflows(listReq);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.items).toHaveLength(1);
      expect(listData.items[0].id).toBe(created.id);

      // GET /api/workflows/[id]
      const getReq = makeGetRequest(`http://localhost:3000/api/workflows/${created.id}`, wsA);
      const getRes = await handleGetWorkflowById(getReq, {
        params: Promise.resolve({ id: created.id }),
      });
      expect(getRes.status).toBe(200);
      const singleData = await getRes.json();
      expect(singleData.id).toBe(created.id);

      // Other workspace cannot access workflow
      const otherGetReq = makeGetRequest(`http://localhost:3000/api/workflows/${created.id}`, wsB);
      const otherGetRes = await handleGetWorkflowById(otherGetReq, {
        params: Promise.resolve({ id: created.id }),
      });
      expect(otherGetRes.status).toBe(404);
    });

    it("creates run for workflow and links previousRunId to latest complete run", async () => {
      const wf = await workflowsRepo.create(wsA, {
        prompt: "Jobs",
        blueprint: validBlueprint,
      });

      // 1. Create a prior complete run
      const prevRun = await runsRepo.create(wsA, {
        workflowId: wf.id,
        status: "complete",
        stage: "complete",
      });

      // 2. POST /api/workflows/[id]/runs
      const runReq = makeJsonRequest(
        `http://localhost:3000/api/workflows/${wf.id}/runs`,
        "POST",
        {},
        wsA
      );
      const runRes = await handlePostRun(runReq, { params: Promise.resolve({ id: wf.id }) });
      expect(runRes.status).toBe(201);

      const runData = await runRes.json();
      expect(runData.status).toBe("queued");
      expect(runData.stage).toBe("planning");
      expect(runData.previousRunId).toBe(prevRun.id);
    });

    it("gets run details, counts, and polls events with ?after", async () => {
      const wf = await workflowsRepo.create(wsA, { prompt: "Test", blueprint: validBlueprint });
      const run = await runsRepo.create(wsA, {
        workflowId: wf.id,
        status: "planning",
        stage: "planning",
      });

      const evt1 = await eventsRepo.create(wsA, {
        runId: run.id,
        stage: "planning",
        level: "info",
        message: "Event 1",
      });

      const evt2 = await eventsRepo.create(wsA, {
        runId: run.id,
        stage: "planning",
        level: "info",
        message: "Event 2",
      });

      // GET /api/runs/[id]
      const getRunReq = makeGetRequest(`http://localhost:3000/api/runs/${run.id}`, wsA);
      const getRunRes = await handleGetRunById(getRunReq, { params: Promise.resolve({ id: run.id }) });
      expect(getRunRes.status).toBe(200);

      const runBody = await getRunRes.json();
      expect(runBody.run.id).toBe(run.id);
      expect(runBody.events.length).toBeGreaterThanOrEqual(2);

      // Poll with ?after=evt1.id
      const pollReq = makeGetRequest(
        `http://localhost:3000/api/runs/${run.id}?after=${evt1.id}`,
        wsA
      );
      const pollRes = await handleGetRunById(pollReq, { params: Promise.resolve({ id: run.id }) });
      expect(pollRes.status).toBe(200);
      const pollBody = await pollRes.json();
      expect(pollBody.events.some((e: { id: string }) => e.id === evt2.id)).toBe(true);
      expect(pollBody.events.some((e: { id: string }) => e.id === evt1.id)).toBe(false);
    });

    it("advances run through pipeline stages", async () => {
      const wf = await workflowsRepo.create(wsA, { prompt: "Test", blueprint: validBlueprint });
      const run = await runsRepo.create(wsA, {
        workflowId: wf.id,
        status: "queued",
        stage: "planning",
      });

      const advReq = makeJsonRequest(
        `http://localhost:3000/api/runs/${run.id}/advance`,
        "POST",
        {},
        wsA
      );
      const advRes = await handleAdvanceRun(advReq, { params: Promise.resolve({ id: run.id }) });
      expect(advRes.status).toBe(200);

      const advData = await advRes.json();
      expect(advData.stage).toBe("discovering");
    });

    it("handles pause, resume, and cancel transitions", async () => {
      const wf = await workflowsRepo.create(wsA, { prompt: "Test", blueprint: validBlueprint });
      const run = await runsRepo.create(wsA, {
        workflowId: wf.id,
        status: "discovering",
        stage: "discovering",
      });

      // Pause
      const pauseReq = makeJsonRequest(
        `http://localhost:3000/api/runs/${run.id}/pause`,
        "POST",
        {},
        wsA
      );
      const pauseRes = await handlePauseRun(pauseReq, { params: Promise.resolve({ id: run.id }) });
      expect(pauseRes.status).toBe(200);
      const pauseData = await pauseRes.json();
      expect(pauseData.status).toBe("paused");

      // Resume
      const resumeReq = makeJsonRequest(
        `http://localhost:3000/api/runs/${run.id}/resume`,
        "POST",
        {},
        wsA
      );
      const resumeRes = await handleResumeRun(resumeReq, {
        params: Promise.resolve({ id: run.id }),
      });
      expect(resumeRes.status).toBe(200);
      const resumeData = await resumeRes.json();
      expect(resumeData.status).toBe("discovering");

      // Cancel
      const cancelReq = makeJsonRequest(
        `http://localhost:3000/api/runs/${run.id}/cancel`,
        "POST",
        {},
        wsA
      );
      const cancelRes = await handleCancelRun(cancelReq, {
        params: Promise.resolve({ id: run.id }),
      });
      expect(cancelRes.status).toBe(200);
      const cancelData = await cancelRes.json();
      expect(cancelData.status).toBe("cancelled");
    });
  });

  describe("Records, Receipts, Sources, Diff, and Export", () => {
    it("searches, filters by status and minConfidence, sorts, and paginates records", async () => {
      const run = await runsRepo.create(wsA, {
        workflowId: "wf_test",
        status: "complete",
        stage: "complete",
      });

      await recordsRepo.create(wsA, {
        runId: run.id,
        workflowId: "wf_test",
        fingerprint: "fp_1",
        values: { title: "Senior Architect", company: "Meta", city: "London" },
        rowConfidence: 0.95,
        flags: [],
      });

      await recordsRepo.create(wsA, {
        runId: run.id,
        workflowId: "wf_test",
        fingerprint: "fp_2",
        values: { title: "Junior Engineer", company: "Google", city: "Lucknow" },
        rowConfidence: 0.60,
        flags: ["contradiction:city"],
      });

      // 1. Filter by minConfidence=0.8
      const confReq = makeGetRequest(
        `http://localhost:3000/api/runs/${run.id}/records?minConfidence=0.8`,
        wsA
      );
      const confRes = await handleGetRunRecords(confReq, { params: Promise.resolve({ id: run.id }) });
      expect(confRes.status).toBe(200);
      const confData = await confRes.json();
      expect(confData.items).toHaveLength(1);
      expect(confData.items[0].values.title).toBe("Senior Architect");

      // 2. Filter by status=flagged
      const flagReq = makeGetRequest(
        `http://localhost:3000/api/runs/${run.id}/records?status=flagged`,
        wsA
      );
      const flagRes = await handleGetRunRecords(flagReq, { params: Promise.resolve({ id: run.id }) });
      expect(flagRes.status).toBe(200);
      const flagData = await flagRes.json();
      expect(flagData.items).toHaveLength(1);
      expect(flagData.items[0].values.title).toBe("Junior Engineer");

      // 3. Search query q=London
      const searchReq = makeGetRequest(
        `http://localhost:3000/api/runs/${run.id}/records?q=London`,
        wsA
      );
      const searchRes = await handleGetRunRecords(searchReq, {
        params: Promise.resolve({ id: run.id }),
      });
      expect(searchRes.status).toBe(200);
      const searchData = await searchRes.json();
      expect(searchData.items).toHaveLength(1);
      expect(searchData.items[0].values.city).toBe("London");
    });

    it("retrieves receipt and located snapshot text window", async () => {
      const run = await runsRepo.create(wsA, {
        workflowId: "wf_test",
        status: "complete",
        stage: "complete",
      });
      // Save snapshot text into memory store
      const { createSnapshotStore } = await import("@/lib/sources/snapshot");
      const snapshotStore = createSnapshotStore();
      const snapResult = await snapshotStore.saveSnapshot({
        workspaceId: wsA,
        runId: run.id,
        url: "https://example.com/jobs/1",
        text: "We are hiring a Lead Developer in Lucknow with great perks.",
        sourceId: "src1",
      });

      const source = await sourcesRepo.create(wsA, {
        runId: run.id,
        url: "https://example.com/jobs/1",
        domain: "example.com",
        discoveredVia: "search",
        robots: { allowed: true, checkedAt: new Date() },
        snapshot: { publicId: snapResult.publicId, url: snapResult.url },
      });

      const record = await recordsRepo.create(wsA, {
        runId: run.id,
        workflowId: "wf_test",
        fingerprint: "fp_rec_1",
        values: { title: "Lead Developer" },
        receipts: {
          title: {
            sourceId: source.id,
            evidence: "Lead Developer",
            confidence: 0.95,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
        },
      });

      const req = makeGetRequest(
        `http://localhost:3000/api/records/${record.id}/receipts/title`,
        wsA
      );
      const res = await handleGetReceipt(req, {
        params: Promise.resolve({ id: record.id, field: "title" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.receipt.evidence).toBe("Lead Developer");
      expect(data.location).toBeDefined();
      expect(data.window).toBeDefined();
      expect(data.window.match).toBe("Lead Developer");
      expect(data.source.url).toBe("https://example.com/jobs/1");
    });

    it("returns run sources list", async () => {
      const run = await runsRepo.create(wsA, {
        workflowId: "wf_test",
        status: "complete",
        stage: "complete",
      });
      await sourcesRepo.create(wsA, {
        runId: run.id,
        url: "https://example.com/sources/1",
        domain: "example.com",
        discoveredVia: "search",
        robots: { allowed: true, checkedAt: new Date() },
      });

      const req = makeGetRequest(`http://localhost:3000/api/runs/${run.id}/sources`, wsA);
      const res = await handleGetRunSources(req, { params: Promise.resolve({ id: run.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(1);
      expect(data.items[0].url).toBe("https://example.com/sources/1");
    });

    it("returns run diff versus previousRunId", async () => {
      const runPrev = await runsRepo.create(wsA, {
        workflowId: "wf_test",
        status: "complete",
        stage: "complete",
      });
      const runCurr = await runsRepo.create(wsA, {
        workflowId: "wf_test",
        status: "complete",
        stage: "complete",
        previousRunId: runPrev.id,
      });

      await recordsRepo.create(wsA, {
        runId: runPrev.id,
        workflowId: "wf_test",
        fingerprint: "fp_old",
        values: { title: "Old Lead" },
      });

      await recordsRepo.create(wsA, {
        runId: runCurr.id,
        workflowId: "wf_test",
        fingerprint: "fp_new",
        values: { title: "New Lead" },
      });

      const req = makeGetRequest(`http://localhost:3000/api/runs/${runCurr.id}/diff`, wsA);
      const res = await handleGetRunDiff(req, { params: Promise.resolve({ id: runCurr.id }) });
      expect(res.status).toBe(200);

      const diff = await res.json();
      expect(diff.summary.added).toBe(1);
      expect(diff.summary.removed).toBe(1);
      expect(diff.summary.changed).toBe(0);
      expect(diff.added[0].fingerprint).toBe("fp_new");
      expect(diff.removed[0].fingerprint).toBe("fp_old");
    });

    it("exports data in csv, json, and xlsx, verifies columns, and parses back file content", async () => {
      const wf = await workflowsRepo.create(wsA, {
        prompt: "Jobs",
        blueprint: {
          intent: "Jobs",
          entity: "Job",
          fields: [{ key: "title", label: "Title", type: "string" as const, required: true, description: "" }],
          keyFields: ["title"],
          sources: [{ kind: "search", query: "developer jobs" }],
          limits: { maxSources: 5, maxRecords: 10 },
        },
      });

      const run = await runsRepo.create(wsA, {
        workflowId: wf.id,
        status: "complete",
        stage: "complete",
      });

      const source = await sourcesRepo.create(wsA, {
        runId: run.id,
        url: "https://example.com/jobs/lead",
        domain: "example.com",
        discoveredVia: "search",
        robots: { allowed: true, checkedAt: new Date() },
      });

      await recordsRepo.create(wsA, {
        runId: run.id,
        workflowId: wf.id,
        fingerprint: "fp_exp_1",
        values: { title: "Lead Developer" },
        receipts: {
          title: {
            sourceId: source.id,
            evidence: "Lead Developer",
            confidence: 0.95,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
        },
      });

      const exportStore = createExportStore();

      for (const format of ["csv", "json", "xlsx"] as const) {
        const req = makeJsonRequest(
          `http://localhost:3000/api/runs/${run.id}/export`,
          "POST",
          { format },
          wsA
        );
        const res = await handleExportRun(req, { params: Promise.resolve({ id: run.id }) });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.format).toBe(format);
        expect(data.url).toBeDefined();
        expect(data.rows).toBe(1);

        // Verify stored in DB
        const saved = await exportsRepo.findById(wsA, data.id);
        expect(saved).not.toBeNull();
        expect(saved?.format).toBe(format);

        // Parse file buffer back from store and verify {field}__source column
        const buffer = await exportStore.getExport(data.url);
        expect(buffer).not.toBeNull();

        if (format === "json") {
          const parsed = JSON.parse(buffer!.toString("utf-8"));
          expect(parsed[0].title).toBe("Lead Developer");
          expect(parsed[0].title__source).toBe("https://example.com/jobs/lead");
        } else if (format === "csv") {
          const csvText = buffer!.toString("utf-8");
          const lines = csvText.trim().split("\n");
          expect(lines[0]).toContain("title__source");
          expect(lines[1]).toContain("https://example.com/jobs/lead");
        } else if (format === "xlsx") {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
          const worksheet = workbook.getWorksheet(1);
          expect(worksheet).toBeDefined();

          const headers: string[] = [];
          worksheet!.getRow(1).eachCell((cell) => {
            headers.push(String(cell.value));
          });
          expect(headers).toContain("title__source");

          const rowValues: string[] = [];
          worksheet!.getRow(2).eachCell((cell) => {
            rowValues.push(String(cell.value));
          });
          expect(rowValues[1]).toBe("https://example.com/jobs/lead");
        }
      }
    });

    it("enforces workspace isolation across all routes", async () => {
      // Create resources in workspace A
      const wfA = await workflowsRepo.create(wsA, {
        prompt: "Jobs A",
        blueprint: {
          intent: "Jobs",
          entity: "Job",
          fields: [{ key: "title", label: "Title", type: "string" as const, required: true, description: "" }],
          keyFields: ["title"],
          sources: [{ kind: "search", query: "jobs" }],
          limits: { maxSources: 5, maxRecords: 10 },
        },
      });

      const runA = await runsRepo.create(wsA, {
        workflowId: wfA.id,
        status: "complete",
        stage: "complete",
      });

      const recA = await recordsRepo.create(wsA, {
        runId: runA.id,
        workflowId: wfA.id,
        fingerprint: "fp_isolated",
        values: { title: "Confidential Lead" },
        receipts: {
          title: {
            sourceId: "src_any",
            evidence: "Confidential Lead",
            confidence: 0.9,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
        },
      });

      // Workspace B tries to access Workspace A's run records -> 404
      const bRecordsReq = makeGetRequest(`http://localhost:3000/api/runs/${runA.id}/records`, wsB);
      const bRecordsRes = await handleGetRunRecords(bRecordsReq, {
        params: Promise.resolve({ id: runA.id }),
      });
      expect(bRecordsRes.status).toBe(404);

      // Workspace B tries to access Workspace A's receipt -> 404
      const bReceiptReq = makeGetRequest(
        `http://localhost:3000/api/records/${recA.id}/receipts/title`,
        wsB
      );
      const bReceiptRes = await handleGetReceipt(bReceiptReq, {
        params: Promise.resolve({ id: recA.id, field: "title" }),
      });
      expect(bReceiptRes.status).toBe(404);

      // Workspace B tries to advance Workspace A's run -> 404
      const bAdvReq = makeJsonRequest(
        `http://localhost:3000/api/runs/${runA.id}/advance`,
        "POST",
        {},
        wsB
      );
      const bAdvRes = await handleAdvanceRun(bAdvReq, { params: Promise.resolve({ id: runA.id }) });
      expect(bAdvRes.status).toBe(404);

      // Workspace B tries to export Workspace A's run -> 404
      const bExpReq = makeJsonRequest(
        `http://localhost:3000/api/runs/${runA.id}/export`,
        "POST",
        { format: "json" },
        wsB
      );
      const bExpRes = await handleExportRun(bExpReq, { params: Promise.resolve({ id: runA.id }) });
      expect(bExpRes.status).toBe(404);

      // Workspace B tries to diff Workspace A's run -> 404
      const bDiffReq = makeGetRequest(`http://localhost:3000/api/runs/${runA.id}/diff`, wsB);
      const bDiffRes = await handleGetRunDiff(bDiffReq, { params: Promise.resolve({ id: runA.id }) });
      expect(bDiffRes.status).toBe(404);
    });
  });

  describe("GET /api/demo/run", () => {
    it("creates workflow and replayable run when DEMO_MODE is true", async () => {
      process.env.DEMO_MODE = "true";
      const req = makeGetRequest("http://localhost:3000/api/demo/run", wsA);
      const res = await handleDemoRun(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.workflow).toBeDefined();
      expect(data.run).toBeDefined();
      expect(data.run.workflowId).toBe(data.workflow.id);
      expect(data.run.status).toBe("queued");
    });

    it("returns 403 when DEMO_MODE is not true", async () => {
      process.env.DEMO_MODE = "false";
      const req = makeGetRequest("http://localhost:3000/api/demo/run", wsA);
      const res = await handleDemoRun(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("DEMO_MODE_DISABLED");
    });
  });
});
