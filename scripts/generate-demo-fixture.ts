import fs from "fs";
import path from "path";
import { createTestDatabase } from "../tests/fixtures/test-db";
import { ensureIndexes } from "../lib/db/indexes";
import { WorkflowsRepo, RunsRepo, SourcesRepo, RecordsRepo, EventsRepo } from "../lib/db/repos";
import { MemorySnapshotStore } from "../lib/sources/snapshot";
import { FakeLlmClient } from "../lib/llm/fake";
import { advance } from "../lib/pipeline/engine";

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

const mockHtmlLucknow1 = `<!DOCTYPE html>
<html>
<head><title>Lucknow Tech Labs - Careers</title></head>
<body>
  <article>
    <h1>Engineering Careers</h1>
    <p>Lucknow Tech Labs is an enterprise solutions partner.</p>
    <p>We are seeking a Junior Full Stack Engineer to join our Lucknow development centre.</p>
    <p>Position is based on-site in Lucknow, Uttar Pradesh.</p>
    <p>Expected compensation: 4.5 to 6.5 LPA depending on evaluation.</p>
    <p>Apply online at https://example.com/jobs/lucknow-dev-1</p>
  </article>
</body>
</html>`;

const mockHtmlLucknow2 = `<!DOCTYPE html>
<html>
<head><title>Gomti Software Systems - Careers</title></head>
<body>
  <article>
    <h1>Careers at Gomti Software</h1>
    <p>Gomti Software Systems is hiring fresh engineering graduates.</p>
    <p>Opening for Software Engineer Trainee at our Gomti Nagar office.</p>
    <p>Job Location: Gomti Nagar, Lucknow.</p>
    <p>Stipend and salary range is 3.5 to 5.0 LPA.</p>
    <p>Apply at https://example.com/jobs/lucknow-dev-2</p>
  </article>
</body>
</html>`;

const mockRobotsTxt = `User-agent: *
Allow: /
`;

const mockPages: Record<string, string> = {
  "https://example.com/robots.txt": mockRobotsTxt,
  "https://example.com/jobs/page1": mockHtmlPage1,
  "https://example.com/jobs/page2": mockHtmlPage2,
  "https://example.com/jobs/page3": mockHtmlPage3,
  "https://example.com/jobs/lucknow-dev-1": mockHtmlLucknow1,
  "https://example.com/jobs/lucknow-dev-2": mockHtmlLucknow2,
};

async function generate() {
  process.env.DEMO_MODE = "true";

  const testDb = await createTestDatabase();
  await ensureIndexes(testDb.db);

  const workspaceId = "ws_demo_fixture";
  const workflowsRepo = new WorkflowsRepo(testDb.db);
  const runsRepo = new RunsRepo(testDb.db);
  const sourcesRepo = new SourcesRepo(testDb.db);
  const recordsRepo = new RecordsRepo(testDb.db);
  const eventsRepo = new EventsRepo(testDb.db);
  const snapshotStore = new MemorySnapshotStore();
  const fakeLlm = new FakeLlmClient();

  const planFixturePath = path.resolve(
    process.cwd(),
    "tests/fixtures/llm/plan-job-openings-for-junior-developers-in-lucknow.json"
  );
  const planData = JSON.parse(fs.readFileSync(planFixturePath, "utf-8"));

  const workflow = await workflowsRepo.create(workspaceId, {
    title: "Junior Developers in Lucknow",
    prompt: planData.prompt,
    blueprint: planData.blueprint,
    status: "ready",
  });

  const run = await runsRepo.create(workspaceId, {
    workflowId: workflow.id,
    status: "queued",
    stage: "planning",
  });

  const fetchFn = async (input: RequestInfo | URL): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (mockPages[urlStr]) {
      const isHtml = urlStr.includes("/jobs/");
      return new Response(mockPages[urlStr], {
        status: 200,
        headers: {
          "Content-Type": isHtml ? "text/html" : "text/plain",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  };

  const deps = {
    db: testDb.db,
    workflowsRepo,
    runsRepo,
    sourcesRepo,
    recordsRepo,
    eventsRepo,
    snapshotStore,
    llmClient: fakeLlm,
    fetchFn,
  };

  let currentRun = run;
  for (let i = 0; i < 15; i++) {
    currentRun = await advance(currentRun.id, workspaceId, deps);
    if (currentRun.status === "complete") {
      break;
    }
  }

  const finalWorkflow = await workflowsRepo.findById(workspaceId, workflow.id);
  const finalSources = await sourcesRepo.list(workspaceId, { runId: currentRun.id, limit: 100 });
  const finalRecords = await recordsRepo.list(workspaceId, { runId: currentRun.id, limit: 100 });
  const finalEvents = await eventsRepo.list(workspaceId, { runId: currentRun.id, limit: 200 });

  const snapshots: Record<string, string> = {};
  for (const src of finalSources.items) {
    if (src.snapshot?.publicId) {
      const text = await snapshotStore.getSnapshot(src.snapshot.publicId);
      if (text) {
        snapshots[src.snapshot.publicId] = text;
      }
    }
  }

  const outputDir = path.resolve(process.cwd(), "tests/fixtures/demo");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, "workflow.json"),
    JSON.stringify(finalWorkflow, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outputDir, "run.json"),
    JSON.stringify(currentRun, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outputDir, "sources.json"),
    JSON.stringify(finalSources.items, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outputDir, "records.json"),
    JSON.stringify(finalRecords.items, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outputDir, "events.json"),
    JSON.stringify(finalEvents.items, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outputDir, "snapshots.json"),
    JSON.stringify(snapshots, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outputDir, "pages.json"),
    JSON.stringify(mockPages, null, 2),
    "utf-8"
  );

  await testDb.close();
  console.log("Demo fixture generated successfully in tests/fixtures/demo");
}

generate().catch((err) => {
  console.error("Fixture generation failed:", err);
  process.exit(1);
});
