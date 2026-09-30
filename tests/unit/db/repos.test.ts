import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDatabase, type TestDatabaseContext } from "@/tests/fixtures/test-db";
import { ensureIndexes } from "@/lib/db/indexes";
import {
  WorkflowsRepo,
  RunsRepo,
  SourcesRepo,
  RecordsRepo,
  EventsRepo,
  ExportsRepo,
} from "@/lib/db/repos";
import type { Blueprint, RunStatus } from "@/lib/db/schemas";

describe("Database Repositories", () => {
  let testDb: TestDatabaseContext;
  let workflowsRepo: WorkflowsRepo;
  let runsRepo: RunsRepo;
  let sourcesRepo: SourcesRepo;
  let recordsRepo: RecordsRepo;
  let eventsRepo: EventsRepo;
  let exportsRepo: ExportsRepo;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    workflowsRepo = new WorkflowsRepo(testDb.db);
    runsRepo = new RunsRepo(testDb.db);
    sourcesRepo = new SourcesRepo(testDb.db);
    recordsRepo = new RecordsRepo(testDb.db);
    eventsRepo = new EventsRepo(testDb.db);
    exportsRepo = new ExportsRepo(testDb.db);
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.cleanAll();
    await ensureIndexes(testDb.db);
  });

  describe("Workspace Isolation", () => {
    it("prevents Workspace A from viewing or updating Workspace B workflows", async () => {
      const wfB = await workflowsRepo.create("ws_b", {
        title: "Confidential B Leads",
        prompt: "Find private leads",
        blueprint: {
          intent: "Private leads",
          entity: "Lead",
          fields: [{ key: "name", label: "Name", type: "string", required: true, description: "" }],
          keyFields: ["name"],
          sources: [{ kind: "search", query: "private" }],
          limits: { maxSources: 5, maxRecords: 10 },
        },
        status: "ready",
      });

      // Workspace A cannot find workflow created by Workspace B
      const foundByA = await workflowsRepo.findById("ws_a", wfB.id);
      expect(foundByA).toBeNull();

      // Workspace A cannot update workflow belonging to Workspace B
      const updatedByA = await workflowsRepo.update("ws_a", wfB.id, {
        title: "Hijacked by A",
      });
      expect(updatedByA).toBeNull();

      // Workflow remains unchanged when queried by Workspace B
      const foundByB = await workflowsRepo.findById("ws_b", wfB.id);
      expect(foundByB?.title).toBe("Confidential B Leads");

      // Listing workflows in Workspace A returns empty list
      const listA = await workflowsRepo.list("ws_a");
      expect(listA.items).toHaveLength(0);

      // Workspace A cannot delete Workspace B workflow
      const deletedByA = await workflowsRepo.delete("ws_a", wfB.id);
      expect(deletedByA).toBe(false);

      const stillExists = await workflowsRepo.findById("ws_b", wfB.id);
      expect(stillExists).toBeDefined();
    });

    it("enforces workspace isolation across runs, sources, records, events, and exports", async () => {
      const wsAlpha = "ws_alpha";
      const wsBeta = "ws_beta";

      const run = await runsRepo.create(wsAlpha, {
        workflowId: "wf_1",
        status: "discovering",
        stage: "discovering",
      });

      // Beta cannot read Alpha run
      expect(await runsRepo.findById(wsBeta, run.id)).toBeNull();

      const source = await sourcesRepo.create(wsAlpha, {
        runId: run.id,
        url: "https://example.com/item1",
        domain: "example.com",
        discoveredVia: "search",
        robots: { allowed: true, checkedAt: new Date() },
        status: "pending",
      });
      expect(await sourcesRepo.findById(wsBeta, source.id)).toBeNull();

      const record = await recordsRepo.create(wsAlpha, {
        runId: run.id,
        workflowId: "wf_1",
        fingerprint: "fp_alpha_01",
        values: { item: "Alpha Secret" },
        receipts: {},
        rowConfidence: 0.9,
      });
      expect(await recordsRepo.findById(wsBeta, record.id)).toBeNull();

      await eventsRepo.create(wsAlpha, {
        runId: run.id,
        ts: new Date(),
        level: "info",
        stage: "discovering",
        message: "Alpha run started",
      });
      const eventsBeta = await eventsRepo.list(wsBeta, { runId: run.id });
      expect(eventsBeta.items).toHaveLength(0);

      const exp = await exportsRepo.create(wsAlpha, {
        runId: run.id,
        format: "csv",
        url: "https://cloudinary.com/exp1.csv",
        rows: 1,
      });
      expect(await exportsRepo.findById(wsBeta, exp.id)).toBeNull();
    });
  });

  describe("Record deduplication and unique fingerprint enforcement", () => {
    it("rejects duplicate fingerprint under the same runId", async () => {
      const ws = "ws_unique_test";
      const runId = "run_uniq_1";

      await recordsRepo.create(ws, {
        runId,
        workflowId: "wf_1",
        fingerprint: "fp_duplicate_check",
        values: { title: "Original" },
        receipts: {},
        rowConfidence: 0.95,
      });

      await expect(
        recordsRepo.create(ws, {
          runId,
          workflowId: "wf_1",
          fingerprint: "fp_duplicate_check",
          values: { title: "Collision" },
          receipts: {},
          rowConfidence: 0.8,
        })
      ).rejects.toThrow();
    });

    it("upserts or merges existing records when upsertByFingerprint is used", async () => {
      const ws = "ws_upsert_test";
      const runId = "run_upsert_1";

      const first = await recordsRepo.upsertByFingerprint(ws, {
        runId,
        workflowId: "wf_1",
        fingerprint: "fp_merge_target",
        values: { title: "Initial Title", salary: 90000 },
        receipts: {},
        rowConfidence: 0.9,
      });
      expect(first.values.salary).toBe(90000);

      const second = await recordsRepo.upsertByFingerprint(ws, {
        runId,
        workflowId: "wf_1",
        fingerprint: "fp_merge_target",
        values: { title: "Initial Title", salary: 95000, location: "Remote" },
        receipts: {},
        rowConfidence: 0.95,
        mergedFrom: ["src_secondary"],
      });

      expect(second.id).toBe(first.id);
      expect(second.values.salary).toBe(95000);
      expect(second.values.location).toBe("Remote");
      expect(second.mergedFrom).toContain("src_secondary");

      const count = await recordsRepo.count(ws, { runId });
      expect(count).toBe(1);
    });
  });

  describe("Pagination with cursor", () => {
    it("paginates records cleanly using opaque cursor", async () => {
      const ws = "ws_paging";
      const runId = "run_page_1";

      for (let i = 1; i <= 5; i++) {
        await recordsRepo.create(ws, {
          runId,
          workflowId: "wf_page",
          fingerprint: `fp_item_${i}`,
          values: { index: i, name: `Record ${i}` },
          receipts: {},
          rowConfidence: 0.9,
        });
      }

      // Page 1: limit 2
      const page1 = await recordsRepo.list(ws, { runId, limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeTruthy();

      // Page 2: limit 2 with cursor from page 1
      const page2 = await recordsRepo.list(ws, {
        runId,
        limit: 2,
        cursor: page1.nextCursor ?? undefined,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.nextCursor).toBeTruthy();

      // IDs in page 2 should not overlap with page 1
      const page1Ids = page1.items.map((r) => r.id);
      for (const item of page2.items) {
        expect(page1Ids).not.toContain(item.id);
      }

      // Page 3: limit 2 with cursor from page 2
      const page3 = await recordsRepo.list(ws, {
        runId,
        limit: 2,
        cursor: page2.nextCursor ?? undefined,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();
    });
  });

  describe("Text search on record values", () => {
    it("searches records by keyword in values", async () => {
      const ws = "ws_text_search";
      const runId = "run_search_test";

      await recordsRepo.create(ws, {
        runId,
        workflowId: "wf_1",
        fingerprint: "fp_eng",
        values: { role: "Principal Infrastructure Engineer", location: "Berlin" },
        receipts: {},
        rowConfidence: 0.9,
      });

      await recordsRepo.create(ws, {
        runId,
        workflowId: "wf_1",
        fingerprint: "fp_pm",
        values: { role: "Technical Product Manager", location: "London" },
        receipts: {},
        rowConfidence: 0.9,
      });

      const searchResult = await recordsRepo.list(ws, {
        runId,
        search: "Infrastructure",
      });

      expect(searchResult.items).toHaveLength(1);
      expect(searchResult.items[0]?.values.role).toBe(
        "Principal Infrastructure Engineer"
      );
    });
  });

  describe("Zod document validation", () => {
    it("rejects invalid workflow creation with descriptive Zod error", async () => {
      await expect(
        workflowsRepo.create("ws_invalid", {
          title: "",
          prompt: "",
          blueprint: {} as unknown as Blueprint,
          status: "ready",
        })
      ).rejects.toThrow();
    });

    it("rejects invalid run record creation", async () => {
      await expect(
        runsRepo.create("ws_invalid", {
          workflowId: "wf_1",
          status: "non-existent-status" as unknown as RunStatus,
          stage: "planning",
        })
      ).rejects.toThrow();
    });
  });

  describe("Runs operations and status updates", () => {
    it("updates run status, stage, and metadata", async () => {
      const ws = "ws_runs_ops";
      const run = await runsRepo.create(ws, {
        workflowId: "wf_1",
        stage: "planning",
      });

      const updated = await runsRepo.updateStatus(ws, run.id, "fetching", "fetching", {
        counts: {
          sourcesFound: 10,
          sourcesFetched: 2,
          valuesExtracted: 0,
          valuesRejected: 0,
          recordsKept: 0,
          duplicatesMerged: 0,
          verified: 0,
          unverified: 0,
        },
      });

      expect(updated?.status).toBe("fetching");
      expect(updated?.stage).toBe("fetching");
      expect(updated?.counts.sourcesFound).toBe(10);

      // Returns null for invalid ID
      const nonExistent = await runsRepo.update(ws, "invalid_id", { stage: "done" });
      expect(nonExistent).toBeNull();
    });

    it("lists runs with workflow filter, status filter, and pagination", async () => {
      const ws = "ws_runs_list";
      await runsRepo.create(ws, { workflowId: "wf_target", stage: "discovering" });
      await runsRepo.create(ws, { workflowId: "wf_target", stage: "complete" });
      await runsRepo.create(ws, { workflowId: "wf_other", stage: "planning" });

      const filtered = await runsRepo.list(ws, { workflowId: "wf_target" });
      expect(filtered.items).toHaveLength(2);

      const paginated = await runsRepo.list(ws, { workflowId: "wf_target", limit: 1 });
      expect(paginated.items).toHaveLength(1);
      expect(paginated.nextCursor).toBeTruthy();

      const page2 = await runsRepo.list(ws, {
        workflowId: "wf_target",
        limit: 1,
        cursor: paginated.nextCursor ?? undefined,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();
    });
  });

  describe("Sources batch insertion and updates", () => {
    it("inserts multiple sources in a single batch and returns empty array on empty input", async () => {
      const ws = "ws_sources_batch";
      const emptyResult = await sourcesRepo.createMany(ws, []);
      expect(emptyResult).toEqual([]);

      const created = await sourcesRepo.createMany(ws, [
        {
          runId: "run_batch",
          url: "https://example.com/item1",
          domain: "example.com",
          discoveredVia: "search",
          robots: { allowed: true, checkedAt: new Date() },
        },
        {
          runId: "run_batch",
          url: "https://example.com/item2",
          domain: "example.com",
          discoveredVia: "search",
          robots: { allowed: true, checkedAt: new Date() },
        },
      ]);

      expect(created).toHaveLength(2);
      expect(created[0]?.id).toBeTruthy();
      expect(created[1]?.id).toBeTruthy();

      // List with runId filter
      const listed = await sourcesRepo.list(ws, { runId: "run_batch" });
      expect(listed.items).toHaveLength(2);

      // Pagination with nextCursor
      const pagedSources = await sourcesRepo.list(ws, { runId: "run_batch", limit: 1 });
      expect(pagedSources.items).toHaveLength(1);
      expect(pagedSources.nextCursor).toBeTruthy();

      // Update source status and snapshot
      const updated = await sourcesRepo.update(ws, created[0]!.id, {
        status: "fetched",
        httpStatus: 200,
        snapshot: { publicId: "snap1", url: "https://example.com/snap1.html" },
      });
      expect(updated?.status).toBe("fetched");
      expect(updated?.httpStatus).toBe(200);

      // Update non-existent returns null
      expect(await sourcesRepo.update(ws, "invalid_id", { status: "failed" })).toBeNull();
      expect(await sourcesRepo.findById(ws, "invalid_id")).toBeNull();
    });
  });

  describe("Records batch insertion and updates", () => {
    it("inserts records in batch, updates existing records, and fetches by ID", async () => {
      const ws = "ws_rec_ops";
      const emptyResult = await recordsRepo.createMany(ws, []);
      expect(emptyResult).toEqual([]);

      const created = await recordsRepo.createMany(ws, [
        {
          runId: "run_m",
          workflowId: "wf_m",
          fingerprint: "fp_m1",
          values: { k: "v1" },
          receipts: {},
          rowConfidence: 0.9,
        },
        {
          runId: "run_m",
          workflowId: "wf_m",
          fingerprint: "fp_m2",
          values: { k: "v2" },
          receipts: {},
          rowConfidence: 0.85,
        },
      ]);

      expect(created).toHaveLength(2);

      // Find by id
      const found = await recordsRepo.findById(ws, created[0]!.id);
      expect(found?.fingerprint).toBe("fp_m1");

      // Update record
      const updated = await recordsRepo.update(ws, created[0]!.id, {
        flags: ["verified-lead"],
        rowConfidence: 0.99,
      });
      expect(updated?.flags).toContain("verified-lead");
      expect(updated?.rowConfidence).toBe(0.99);

      // Invalid ID returns null
      expect(await recordsRepo.findById(ws, "invalid_id")).toBeNull();
      expect(await recordsRepo.update(ws, "invalid_id", { flags: [] })).toBeNull();
    });
  });

  describe("Events and Exports operations", () => {
    it("lists events filtered by level and exports by runId", async () => {
      const ws = "ws_events_exports";
      const runId = "run_ee_1";

      await eventsRepo.create(ws, {
        runId,
        ts: new Date(),
        level: "info",
        stage: "discovering",
        message: "Found 2 sources",
      });
      await eventsRepo.create(ws, {
        runId,
        ts: new Date(),
        level: "warn",
        stage: "fetching",
        message: "Source returned 404",
      });

      const infoEvents = await eventsRepo.list(ws, { runId, level: "info" });
      expect(infoEvents.items).toHaveLength(1);
      expect(infoEvents.items[0]?.level).toBe("info");

      // Events pagination nextCursor
      const pagedEvents = await eventsRepo.list(ws, { runId, limit: 1 });
      expect(pagedEvents.items).toHaveLength(1);
      expect(pagedEvents.nextCursor).toBeTruthy();

      const exportDoc = await exportsRepo.create(ws, {
        runId,
        format: "csv",
        url: "https://example.com/data.csv",
        rows: 25,
      });

      await exportsRepo.create(ws, {
        runId,
        format: "json",
        url: "https://example.com/data2.json",
        rows: 10,
      });

      const foundExport = await exportsRepo.findById(ws, exportDoc.id);
      expect(foundExport?.format).toBe("csv");
      expect(foundExport?.rows).toBe(25);

      const exportList = await exportsRepo.list(ws, { runId });
      expect(exportList.items).toHaveLength(2);

      const pagedExports = await exportsRepo.list(ws, { runId, limit: 1 });
      expect(pagedExports.items).toHaveLength(1);
      expect(pagedExports.nextCursor).toBeTruthy();

      expect(await exportsRepo.findById(ws, "invalid_id")).toBeNull();
    });
  });

  describe("Workflow list and delete operations", () => {
    it("paginates workflows and handles non-existent IDs gracefully", async () => {
      const ws = "ws_wf_list";
      const wf1 = await workflowsRepo.create(ws, {
        title: "Workflow One",
        prompt: "First",
        blueprint: {
          intent: "Collect One",
          entity: "One",
          fields: [{ key: "f", label: "F", type: "string", required: true, description: "" }],
          keyFields: ["f"],
          sources: [{ kind: "search", query: "q1" }],
          limits: { maxSources: 5, maxRecords: 10 },
        },
      });
      await workflowsRepo.create(ws, {
        title: "Workflow Two",
        prompt: "Second",
        blueprint: {
          intent: "Collect Two",
          entity: "Two",
          fields: [{ key: "f", label: "F", type: "string", required: true, description: "" }],
          keyFields: ["f"],
          sources: [{ kind: "search", query: "q2" }],
          limits: { maxSources: 5, maxRecords: 10 },
        },
      });

      const page1 = await workflowsRepo.list(ws, { limit: 1 });
      expect(page1.items).toHaveLength(1);
      expect(page1.nextCursor).toBeTruthy();

      const page2 = await workflowsRepo.list(ws, { limit: 1, cursor: page1.nextCursor ?? undefined });
      expect(page2.items).toHaveLength(1);

      // Clean deletion
      expect(await workflowsRepo.delete(ws, wf1.id)).toBe(true);
      expect(await workflowsRepo.delete(ws, "invalid_id")).toBe(false);
      expect(await workflowsRepo.findById(ws, "invalid_id")).toBeNull();
      expect(await workflowsRepo.update(ws, "invalid_id", { title: "None" })).toBeNull();
    });
  });

  describe("Repository types and cursor helpers", () => {
    it("handles malformed and non-standard cursor strings safely", async () => {
      // Malformed base64
      const resMalformed = await recordsRepo.list("ws_cursor_edge", {
        cursor: "not-base64-json-at-all",
      });
      expect(resMalformed.items).toEqual([]);

      // Non-JSON valid base64
      const resNonJson = await recordsRepo.list("ws_cursor_edge", {
        cursor: Buffer.from("plain string").toString("base64url"),
      });
      expect(resNonJson.items).toEqual([]);

      // JSON missing required fields
      const resBadJson = await recordsRepo.list("ws_cursor_edge", {
        cursor: Buffer.from(JSON.stringify({ wrong: 123 })).toString("base64url"),
      });
      expect(resBadJson.items).toEqual([]);
    });
  });
});

