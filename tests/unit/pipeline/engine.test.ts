import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createTestDatabase, type TestDatabaseContext } from "@/tests/fixtures/test-db";
import { ensureIndexes } from "@/lib/db/indexes";
import {
  WorkflowsRepo,
  RunsRepo,
  SourcesRepo,
  RecordsRepo,
  EventsRepo,
} from "@/lib/db/repos";
import { MemorySnapshotStore } from "@/lib/sources/snapshot";
import { FakeLlmClient } from "@/lib/llm/fake";
import { advance, pauseRun, resumeRun, cancelRun } from "@/lib/pipeline/engine";
import type { Blueprint } from "@/lib/db/schemas";
import type { LlmClient, ExtractParams, ExtractedRow } from "@/lib/llm/types";

const mockHtmlPage1 = `<!DOCTYPE html>
<html>
<head><title>Apex Software - Junior Developer</title></head>
<body>
  <article>
    <h1>Junior Developer</h1>
    <p>Role: Junior Developer</p>
    <p>Company: Apex Software</p>
    <p>Location: Lucknow</p>
    <p>Salary: $60,000</p>
    <p>Apply at https://example.com/jobs/page1</p>
  </article>
</body>
</html>`;

const mockHtmlPage2 = `<!DOCTYPE html>
<html>
<head><title>Zenith Labs - Junior Developer</title></head>
<body>
  <article>
    <h1>Junior Developer</h1>
    <p>Role: Junior Developer</p>
    <p>Company: Zenith Labs</p>
    <p>Location: Lucknow</p>
    <p>Salary: $65,000</p>
    <p>Apply at https://example.com/jobs/page2</p>
  </article>
</body>
</html>`;

const mockHtmlPage3 = `<!DOCTYPE html>
<html>
<head><title>Apex Software mirror - Junior Developer</title></head>
<body>
  <article>
    <h1>Junior Developer</h1>
    <p>Role: Junior Developer</p>
    <p>Company: Apex Software</p>
    <p>Location: Lucknow</p>
    <p>Salary: $60,000</p>
    <p>Apply at https://example.com/jobs/page3</p>
  </article>
</body>
</html>`;

const mockRobotsDisallowedTxt = `User-agent: *
Disallow: /
`;

const mockRobotsAllowedTxt = `User-agent: *
Allow: /
`;

describe("Pipeline Engine", () => {
  let testDb: TestDatabaseContext;
  let workflowsRepo: WorkflowsRepo;
  let runsRepo: RunsRepo;
  let sourcesRepo: SourcesRepo;
  let recordsRepo: RecordsRepo;
  let eventsRepo: EventsRepo;
  let snapshotStore: MemorySnapshotStore;
  let fakeLlm: FakeLlmClient;

  let page500Attempts = 0;

  const server = setupServer(
    http.get("https://example.com/robots.txt", () => {
      return new HttpResponse(mockRobotsAllowedTxt, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }),
    http.get("https://example.com/jobs/page1", () => {
      return new HttpResponse(mockHtmlPage1, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),
    http.get("https://example.com/jobs/page2", () => {
      return new HttpResponse(mockHtmlPage2, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),
    http.get("https://example.com/jobs/page3", () => {
      return new HttpResponse(mockHtmlPage3, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),
    http.get("https://blocked.example.com/robots.txt", () => {
      return new HttpResponse(mockRobotsDisallowedTxt, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }),
    http.get("https://blocked.example.com/jobs/private", () => {
      return new HttpResponse("<html><body>Private Jobs</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),
    http.get("https://flakey.example.com/robots.txt", () => {
      return new HttpResponse(mockRobotsAllowedTxt, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }),
    http.get("https://flakey.example.com/jobs/broken", () => {
      page500Attempts++;
      return new HttpResponse("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    })
  );

  beforeAll(async () => {
    server.listen();
    testDb = await createTestDatabase();
    workflowsRepo = new WorkflowsRepo(testDb.db);
    runsRepo = new RunsRepo(testDb.db);
    sourcesRepo = new SourcesRepo(testDb.db);
    recordsRepo = new RecordsRepo(testDb.db);
    eventsRepo = new EventsRepo(testDb.db);
    snapshotStore = new MemorySnapshotStore();
    fakeLlm = new FakeLlmClient();
  });

  afterAll(async () => {
    server.close();
    await testDb.close();
  });

  beforeEach(async () => {
    server.resetHandlers();
    page500Attempts = 0;
    await testDb.cleanAll();
    await ensureIndexes(testDb.db);
    snapshotStore.clear();
  });

  const sampleBlueprint: Blueprint = {
    intent: "Find junior developer positions",
    entity: "JobOpening",
    fields: [
      { key: "job_title", label: "Job Title", type: "string", required: true, description: "" },
      { key: "company_name", label: "Company Name", type: "string", required: true, description: "" },
      { key: "salary", label: "Salary", type: "number", required: false, description: "" },
      { key: "source_url", label: "Source URL", type: "url", required: true, description: "" },
    ],
    keyFields: ["job_title", "company_name"],
    sources: [
      { kind: "search", query: "junior dev jobs" },
    ],
    limits: {
      maxSources: 10,
      maxRecords: 20,
    },
  };

  async function createTestRun(workspaceId = "ws_test", bp = sampleBlueprint) {
    const wf = await workflowsRepo.create(workspaceId, {
      title: "Junior Dev Pipeline",
      prompt: "Find junior dev jobs",
      blueprint: bp,
    });
    const run = await runsRepo.create(workspaceId, {
      workflowId: wf.id,
      stage: "planning",
      status: "queued",
    });
    return { wf, run };
  }

  function getDeps(overrideLlm?: LlmClient) {
    return {
      db: testDb.db,
      llmClient: overrideLlm || fakeLlm,
      snapshotStore,
      runsRepo,
      workflowsRepo,
      sourcesRepo,
      recordsRepo,
      eventsRepo,
    };
  }

  it("completes full happy-path run over three fixture pages producing exact expected dataset", async () => {
    const { run } = await createTestRun("ws_happy");
    const deps = getDeps();

    let current = run;
    let iterations = 0;
    const maxIterations = 20;

    while (current.status !== "complete" && iterations < maxIterations) {
      iterations++;
      current = await advance(current.id, "ws_happy", deps, { budgetMs: 5000 });
      if (current.status === "failed") {
        throw new Error(`Run failed unexpectedly: ${current.error}`);
      }
    }

    expect(current.status).toBe("complete");
    expect(current.stage).toBe("complete");
    expect(current.finishedAt).toBeInstanceOf(Date);

    // Verify sources count
    expect(current.counts.sourcesFound).toBe(3);
    expect(current.counts.sourcesFetched).toBe(3);

    // Verify deduping: page1 and page3 both have Apex Software, Junior Developer
    // So Apex Software is merged (1 duplicate merged)
    expect(current.counts.duplicatesMerged).toBe(1);
    expect(current.counts.recordsKept).toBe(2);

    const records = await recordsRepo.list("ws_happy", { runId: current.id, limit: 10 });
    expect(records.items.length).toBe(2);

    const apexRecord = records.items.find((r) => r.values.company_name === "Apex Software");
    const zenithRecord = records.items.find((r) => r.values.company_name === "Zenith Labs");

    expect(apexRecord).toBeDefined();
    expect(zenithRecord).toBeDefined();

    // Apex record was merged from 2 sources
    expect(apexRecord!.mergedFrom.length).toBe(2);
    expect(apexRecord!.receipts.job_title.validator.status).toBe("verified");
    expect(apexRecord!.values.salary).toBe(60000);

    // Zenith record from 1 source
    expect(zenithRecord!.mergedFrom.length).toBe(1);
    expect(zenithRecord!.values.salary).toBe(65000);
  });

  it("rejects hallucinated value whose evidence is not present in snapshot", async () => {
    const hallucinatingLlm: LlmClient = {
      async planBlueprint() {
        return sampleBlueprint;
      },
      async discover() {
        return {
          summary: "Found page",
          urls: [{ url: "https://example.com/jobs/page1", title: "Apex Jobs" }],
        };
      },
      async extract(): Promise<ExtractedRow[]> {
        return [
          {
            job_title: {
              value: "Junior Developer",
              evidence: "Junior Developer",
              confidence: 0.95,
            },
            company_name: {
              value: "Apex Software",
              evidence: "Company: Apex Software",
              confidence: 0.95,
            },
            salary: {
              value: 120000,
              // Hallucinated evidence quote that is NOT anywhere in mockHtmlPage1!
              evidence: "Base compensation is $120,000 with equity package",
              confidence: 0.8,
            },
            source_url: {
              value: "https://example.com/jobs/page1",
              evidence: "https://example.com/jobs/page1",
              confidence: 1.0,
            },
          },
        ];
      },
    };

    const { run } = await createTestRun("ws_hallucinate");
    const deps = getDeps(hallucinatingLlm);

    let current = run;
    while (current.status !== "complete") {
      current = await advance(current.id, "ws_hallucinate", deps);
      if (current.status === "failed") {
        throw new Error(`Run failed: ${current.error}`);
      }
    }

    expect(current.counts.valuesRejected).toBeGreaterThanOrEqual(1);

    const records = await recordsRepo.list("ws_hallucinate", { runId: current.id });
    expect(records.items.length).toBe(1);
    const rec = records.items[0];
    // Salary value was rejected because evidence failed verification!
    expect(rec.values.salary).toBeUndefined();
    expect(rec.receipts.salary).toBeUndefined();
    expect(rec.values.company_name).toBe("Apex Software");
  });

  it("merges duplicate across two pages and keeps two receipts with boosted confidence", async () => {
    const duplicateLlm: LlmClient = {
      async planBlueprint() {
        return sampleBlueprint;
      },
      async discover() {
        return {
          summary: "Found duplicates",
          urls: [
            { url: "https://example.com/jobs/page1", title: "Apex Board 1" },
            { url: "https://example.com/jobs/page3", title: "Apex Board 2" },
          ],
        };
      },
      async extract(params: ExtractParams): Promise<ExtractedRow[]> {
        return [
          {
            job_title: {
              value: "Junior Developer",
              evidence: "Junior Developer",
              confidence: 0.8,
            },
            company_name: {
              value: "Apex Software",
              evidence: "Company: Apex Software",
              confidence: 0.85,
            },
            salary: {
              value: 60000,
              evidence: "Salary: $60,000",
              confidence: 0.8,
            },
            source_url: {
              value: params.url,
              evidence: params.url,
              confidence: 1.0,
            },
          },
        ];
      },
    };

    const { run } = await createTestRun("ws_dedupe");
    const deps = getDeps(duplicateLlm);

    let current = run;
    while (current.status !== "complete") {
      current = await advance(current.id, "ws_dedupe", deps);
    }

    expect(current.counts.duplicatesMerged).toBe(1);
    expect(current.counts.recordsKept).toBe(1);

    const records = await recordsRepo.list("ws_dedupe", { runId: current.id });
    expect(records.items.length).toBe(1);
    const rec = records.items[0];

    expect(rec.mergedFrom.length).toBe(2);
    // Salary receipt has boosted confidence above original 0.8
    expect(rec.receipts.salary.confidence).toBeGreaterThan(0.8);
    expect(rec.receipts.salary.validator.status).toBe("verified");
  });

  it("flags contradiction when two sources provide conflicting values for the same field", async () => {
    const contradictingLlm: LlmClient = {
      async planBlueprint() {
        return sampleBlueprint;
      },
      async discover() {
        return {
          summary: "Found pages",
          urls: [
            { url: "https://example.com/jobs/page1", title: "Apex Board A" },
            { url: "https://example.com/jobs/page3", title: "Apex Board B" },
          ],
        };
      },
      async extract(params: ExtractParams): Promise<ExtractedRow[]> {
        if (params.url.includes("page1")) {
          return [
            {
              job_title: { value: "Junior Developer", evidence: "Junior Developer", confidence: 0.9 },
              company_name: { value: "Apex Software", evidence: "Company: Apex Software", confidence: 0.9 },
              salary: { value: 60000, evidence: "Salary: $60,000", confidence: 0.85 },
              source_url: { value: params.url, evidence: params.url, confidence: 1.0 },
            },
          ];
        }
        return [
          {
            job_title: { value: "Junior Developer", evidence: "Junior Developer", confidence: 0.9 },
            company_name: { value: "Apex Software", evidence: "Company: Apex Software", confidence: 0.9 },
            // Conflicting salary!
            salary: { value: 95000, evidence: "Salary: $60,000", confidence: 0.85 },
            source_url: { value: params.url, evidence: params.url, confidence: 1.0 },
          },
        ];
      },
    };

    const { run } = await createTestRun("ws_conflict");
    const deps = getDeps(contradictingLlm);

    let current = run;
    while (current.status !== "complete") {
      current = await advance(current.id, "ws_conflict", deps);
    }

    const records = await recordsRepo.list("ws_conflict", { runId: current.id });
    expect(records.items.length).toBe(1);
    const rec = records.items[0];

    // Contradiction must be flagged in record flags
    expect(rec.flags.some((f) => f.includes("contradiction"))).toBe(true);
    expect(rec.receipts.salary.validator.status).toBe("contradicted");
  });

  it("skips robots-disallowed page and records a reason in events", async () => {
    const blueprintWithDisallowed: Blueprint = {
      ...sampleBlueprint,
      sources: [
        { kind: "url", url: "https://blocked.example.com/jobs/private" },
        { kind: "url", url: "https://example.com/jobs/page1" },
      ],
    };

    const { run } = await createTestRun("ws_robots", blueprintWithDisallowed);
    const deps = getDeps();

    let current = run;
    while (current.status !== "complete") {
      current = await advance(current.id, "ws_robots", deps);
    }

    expect(current.counts.sourcesFound).toBe(2);
    expect(current.counts.sourcesFetched).toBe(1);

    const sources = await sourcesRepo.list("ws_robots", { runId: current.id });
    const blockedSource = sources.items.find((s) => s.url.includes("blocked.example.com"));
    expect(blockedSource).toBeDefined();
    expect(blockedSource!.status).toBe("blocked");
    expect(blockedSource!.robots.allowed).toBe(false);

    const events = await eventsRepo.list("ws_robots", { runId: current.id, limit: 50 });
    const blockedEvent = events.items.find((e) =>
      e.message.toLowerCase().includes("robots") ||
      (e.meta && typeof e.meta.url === "string" && e.meta.url.includes("blocked.example.com"))
    );
    expect(blockedEvent).toBeDefined();
  });

  it("handles crash in the middle of extracting and resumes without duplicates", async () => {
    let callCount = 0;
    const crashLlm: LlmClient = {
      async planBlueprint() {
        return sampleBlueprint;
      },
      async discover() {
        return {
          summary: "Found pages",
          urls: [
            { url: "https://example.com/jobs/page1", title: "Page 1" },
            { url: "https://example.com/jobs/page2", title: "Page 2" },
          ],
        };
      },
      async extract(params: ExtractParams): Promise<ExtractedRow[]> {
        callCount++;
        if (callCount === 2) {
          throw new Error("Simulated network crash during extract of page 2");
        }
        return [
          {
            job_title: { value: "Junior Developer", evidence: "Junior Developer", confidence: 0.9 },
            company_name: {
              value: params.url.includes("page1") ? "Apex Software" : "Zenith Labs",
              evidence: params.url.includes("page1") ? "Company: Apex Software" : "Company: Zenith Labs",
              confidence: 0.9,
            },
            source_url: { value: params.url, evidence: params.url, confidence: 1.0 },
          },
        ];
      },
    };

    const { run } = await createTestRun("ws_crash");
    const deps = getDeps(crashLlm);

    let current = run;
    // Advance through planning, discovering, fetching
    while (current.stage !== "extracting") {
      current = await advance(current.id, "ws_crash", deps);
    }

    // Now in extracting stage: first batch will extract page 1, then crash on page 2
    try {
      await advance(current.id, "ws_crash", deps);
    } catch {
      // Caught the crash
    }

    // Resume advancing: the engine should pick up where it left off without duplicating page 1
    // Reset crash condition
    callCount = 10;
    while (current.status !== "complete") {
      current = await advance(current.id, "ws_crash", deps);
    }

    expect(current.status).toBe("complete");
    const records = await recordsRepo.list("ws_crash", { runId: current.id });
    // Exactly 2 distinct records: Apex Software and Zenith Labs, no duplicates
    expect(records.items.length).toBe(2);
  });

  it("cancels mid-run at batch boundary", async () => {
    const { run } = await createTestRun("ws_cancel");
    const deps = getDeps();

    // Advance planning -> discovering
    let current = await advance(run.id, "ws_cancel", deps);
    expect(current.stage).toBe("discovering");

    // Request cancellation
    current = await cancelRun(current.id, "ws_cancel", deps);
    expect(current.status).toBe("cancelled");

    // Further advance does not advance pipeline
    const after = await advance(current.id, "ws_cancel", deps);
    expect(after.status).toBe("cancelled");
  });

  it("pauses and resumes run properly", async () => {
    const { run } = await createTestRun("ws_pause");
    const deps = getDeps();

    let current = await advance(run.id, "ws_pause", deps);
    expect(current.stage).toBe("discovering");

    // Pause run
    current = await pauseRun(current.id, "ws_pause", deps);
    expect(current.status).toBe("paused");

    // Calling advance while paused does nothing
    const stillPaused = await advance(current.id, "ws_pause", deps);
    expect(stillPaused.status).toBe("paused");
    expect(stillPaused.stage).toBe("discovering");

    // Resume run
    current = await resumeRun(current.id, "ws_pause", deps);
    expect(current.status).not.toBe("paused");

    // Next advance continues
    const continued = await advance(current.id, "ws_pause", deps);
    expect(["discovering", "fetching"]).toContain(continued.stage);
  });

  it("retries failed 500 page up to 2 times before marking as failed", async () => {
    const blueprintWith500: Blueprint = {
      ...sampleBlueprint,
      sources: [
        { kind: "url", url: "https://flakey.example.com/jobs/broken" },
        { kind: "url", url: "https://example.com/jobs/page1" },
      ],
    };

    const { run } = await createTestRun("ws_500", blueprintWith500);
    const deps = getDeps();

    let current = run;
    while (current.status !== "complete") {
      current = await advance(current.id, "ws_500", deps);
    }

    expect(page500Attempts).toBeGreaterThanOrEqual(2);

    const sources = await sourcesRepo.list("ws_500", { runId: current.id });
    const brokenSource = sources.items.find((s) => s.url.includes("flakey.example.com"));
    expect(brokenSource).toBeDefined();
    expect(brokenSource!.status).toBe("failed");

    const healthySource = sources.items.find((s) => s.url.includes("page1"));
    expect(healthySource).toBeDefined();
    expect(healthySource!.status).toBe("fetched");

    expect(current.counts.sourcesFetched).toBe(1);
  });

  it("throws error when run is not found", async () => {
    const deps = getDeps();
    await expect(advance("non_existent_run_id", "ws_none", deps)).rejects.toThrow("not found");
  });

  it("marks run as failed when workflow is not found", async () => {
    const run = await runsRepo.create("ws_no_wf", {
      workflowId: "non_existent_wf_id",
      stage: "planning",
      status: "queued",
    });
    const deps = getDeps();
    const result = await advance(run.id, "ws_no_wf", deps);
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Workflow not found");
  });

  it("caps sources when exceeding limits.maxSources and discards malformed URLs", async () => {
    const cappedBlueprint: Blueprint = {
      ...sampleBlueprint,
      sources: [
        { kind: "url", url: "https://example.com/jobs/page1" },
        { kind: "url", url: "https://example.com/jobs/page2" },
        { kind: "url", url: "https://example.com/jobs/page3" },
        { kind: "url", url: "invalid-url-without-scheme" },
      ],
      limits: {
        maxSources: 2,
        maxRecords: 10,
      },
    };

    const { run } = await createTestRun("ws_capped", cappedBlueprint);
    const deps = getDeps();

    let current = await advance(run.id, "ws_capped", deps);
    expect(current.stage).toBe("discovering");

    current = await advance(current.id, "ws_capped", deps);
    expect(current.stage).toBe("fetching");
    expect(current.counts.sourcesFound).toBe(2);
  });

  it("returns completed, failed, or cancelled runs immediately", async () => {
    const { run } = await createTestRun("ws_terminal");
    const deps = getDeps();

    await runsRepo.updateStatus("ws_terminal", run.id, "complete", "complete");
    const completed = await advance(run.id, "ws_terminal", deps);
    expect(completed.status).toBe("complete");

    // Pause terminal run is no-op
    const pausedTerminal = await pauseRun(run.id, "ws_terminal", deps);
    expect(pausedTerminal.status).toBe("complete");

    // Cancel terminal run is no-op
    const cancelledTerminal = await cancelRun(run.id, "ws_terminal", deps);
    expect(cancelledTerminal.status).toBe("complete");
  });
});

