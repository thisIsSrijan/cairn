import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDatabase, type TestDatabaseContext } from "@/tests/fixtures/test-db";
import { ensureIndexes } from "@/lib/db/indexes";

describe("MongoDB Indexes", () => {
  let testDb: TestDatabaseContext;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.cleanAll();
  });

  it("creates required indexes and is completely idempotent", async () => {
    await ensureIndexes(testDb.db);
    // Running a second time should not fail
    await expect(ensureIndexes(testDb.db)).resolves.not.toThrow();

    const recordIndexes = await testDb.db.collection("records").indexes();
    const indexNames = recordIndexes.map((idx) => idx.name);

    expect(indexNames).toContain("records_workspace_created");
    expect(indexNames).toContain("records_run_fingerprint_unique");
    expect(indexNames).toContain("records_text_search");
  });

  it("enforces unique runId plus fingerprint on records collection", async () => {
    await ensureIndexes(testDb.db);

    const record1 = {
      workspaceId: "ws_alpha",
      runId: "run_100",
      workflowId: "wf_1",
      fingerprint: "fp_identical_token",
      values: { title: "Software Engineer" },
      receipts: {},
      rowConfidence: 0.9,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    };

    await testDb.db.collection("records").insertOne(record1);

    // Duplicate runId + fingerprint in same or different workspace must be rejected by unique index
    const duplicate = {
      workspaceId: "ws_alpha",
      runId: "run_100",
      workflowId: "wf_1",
      fingerprint: "fp_identical_token",
      values: { title: "Software Engineer Duplicate" },
      receipts: {},
      rowConfidence: 0.9,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    };

    await expect(testDb.db.collection("records").insertOne(duplicate)).rejects.toThrow(
      /E11000 duplicate key error/
    );

    // Same fingerprint in a different run should succeed
    const differentRun = {
      ...duplicate,
      runId: "run_200",
    };

    await expect(testDb.db.collection("records").insertOne(differentRun)).resolves.toBeDefined();
  });

  it("allows text searches across record dynamic values", async () => {
    await ensureIndexes(testDb.db);

    await testDb.db.collection("records").insertMany([
      {
        workspaceId: "ws_search",
        runId: "run_search_1",
        workflowId: "wf_1",
        fingerprint: "fp_s1",
        values: { role: "Founding Distributed Systems Architect", company: "Cairn Tech" },
        receipts: {},
        rowConfidence: 1,
        flags: [],
        mergedFrom: [],
        createdAt: new Date(),
      },
      {
        workspaceId: "ws_search",
        runId: "run_search_1",
        workflowId: "wf_1",
        fingerprint: "fp_s2",
        values: { role: "Product Designer", company: "Ledger Labs" },
        receipts: {},
        rowConfidence: 1,
        flags: [],
        mergedFrom: [],
        createdAt: new Date(),
      },
    ]);

    const results = await testDb.db
      .collection("records")
      .find({
        workspaceId: "ws_search",
        $text: { $search: "Distributed" },
      })
      .toArray();

    expect(results).toHaveLength(1);
    expect(results[0]?.fingerprint).toBe("fp_s1");
  });
});
