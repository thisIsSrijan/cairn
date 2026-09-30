import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { WorkflowsRepo, RunsRepo, SourcesRepo, RecordsRepo } from "@/lib/db/repos";
import { getMemorySnapshotStore } from "@/lib/sources/snapshot";
import type { Receipt } from "@/lib/db/schemas";

export async function GET(req: NextRequest) {
  try {
    if (process.env.DEMO_MODE !== "true") {
      return errorResponse("DEMO_MODE_DISABLED", "Demo mode is disabled", 403);
    }

    const ctx = extractWorkspaceId(req);
    const db = await getDb();
    const workflowsRepo = new WorkflowsRepo(db);
    const runsRepo = new RunsRepo(db);
    const sourcesRepo = new SourcesRepo(db);
    const recordsRepo = new RecordsRepo(db);

    const targetRunId = req.nextUrl.searchParams.get("runId");
    if (targetRunId) {
      const existingRun = await runsRepo.findById(ctx.workspaceId, targetRunId);
      if (!existingRun) {
        return errorResponse("NOT_FOUND", "Run not found", 404);
      }

      // Complete this run with a second run variation fixture (+1 added, -1 removed, ~1 changed)
      const updatedRun = await runsRepo.update(ctx.workspaceId, targetRunId, {
        status: "complete",
        stage: "complete",
        finishedAt: new Date(),
        counts: {
          sourcesFound: 5,
          sourcesFetched: 3,
          valuesExtracted: 26,
          valuesRejected: 2,
          recordsKept: 2,
          duplicatesMerged: 0,
          verified: 2,
          unverified: 0,
        },
      });

      // Update workflow's latestRunId
      await workflowsRepo.update(ctx.workspaceId, existingRun.workflowId, {
        latestRunId: targetRunId,
        status: "completed",
      });

      // 1. Changed record (same fingerprint as first record from run 1, but with updated values)
      await recordsRepo.create(ctx.workspaceId, {
        runId: targetRunId,
        workflowId: existingRun.workflowId,
        fingerprint: "5dd6e0748bb83d740e1192ff56e9fae823152d2e7fa749972557dd76b3dc1e64",
        values: {
          job_title: "Full Stack Team Lead",
          company_name: "Lucknow Tech Labs",
          location: "Lucknow, Uttar Pradesh",
          salary_range: "6.0 to 8.5 LPA",
          source_url: "https://example.com/jobs/lucknow-dev-1",
        },
        receipts: {
          job_title: {
            sourceId: "src_demo_lead",
            evidence: "Promoted role for Full Stack Team Lead at our Lucknow development centre.",
            confidence: 0.98,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
          salary_range: {
            sourceId: "src_demo_lead",
            evidence: "Updated salary bracket: 6.0 to 8.5 LPA.",
            confidence: 0.95,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
        },
        rowConfidence: 0.96,
        flags: [],
        mergedFrom: [],
      });

      // 2. Added record (new fingerprint)
      await recordsRepo.create(ctx.workspaceId, {
        runId: targetRunId,
        workflowId: existingRun.workflowId,
        fingerprint: "added_dev_awadh_fp_99",
        values: {
          job_title: "Senior Python Engineer",
          company_name: "Awadh Software",
          location: "Lucknow",
          salary_range: "8.0 to 12.0 LPA",
          source_url: "https://example.com/jobs/lucknow-dev-3",
        },
        receipts: {
          job_title: {
            sourceId: "src_demo_awadh",
            evidence: "Hiring a Senior Python Engineer in Lucknow.",
            confidence: 0.97,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
          company_name: {
            sourceId: "src_demo_awadh",
            evidence: "Awadh Software engineering team is expanding.",
            confidence: 0.99,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
        },
        rowConfidence: 0.98,
        flags: [],
        mergedFrom: [],
      });

      return jsonResponse({ run: updatedRun }, ctx, 200);
    }

    const fixtureDir = path.resolve(process.cwd(), "tests/fixtures/demo");
    const workflowFixturePath = path.join(fixtureDir, "workflow.json");

    let blueprintData;
    let prompt = "job openings for junior developers in Lucknow";
    let title = "Junior Developers in Lucknow";

    if (fs.existsSync(workflowFixturePath)) {
      const recorded = JSON.parse(fs.readFileSync(workflowFixturePath, "utf-8"));
      blueprintData = recorded.blueprint;
      prompt = recorded.prompt || prompt;
      title = recorded.title || title;
    } else {
      const planFixturePath = path.resolve(
        process.cwd(),
        "tests/fixtures/llm/plan-job-openings-for-junior-developers-in-lucknow.json"
      );
      const plan = JSON.parse(fs.readFileSync(planFixturePath, "utf-8"));
      blueprintData = plan.blueprint;
      prompt = plan.prompt;
    }

    const workflow = await workflowsRepo.create(ctx.workspaceId, {
      title,
      prompt,
      blueprint: blueprintData,
      status: "ready",
    });

    const isCompleteRequested = req.nextUrl.searchParams.get("complete") === "true";

    if (!isCompleteRequested) {
      const run = await runsRepo.create(ctx.workspaceId, {
        workflowId: workflow.id,
        status: "queued",
        stage: "planning",
        cursor: { isDemo: true },
      });

      return jsonResponse({ workflow, run }, ctx, 201);
    }

    // Seed completed dataset for results screen evaluation
    const memorySnapshotStore = getMemorySnapshotStore();
    const snapshotsPath = path.join(fixtureDir, "snapshots.json");
    if (fs.existsSync(snapshotsPath)) {
      const snapshots: Record<string, string> = JSON.parse(
        fs.readFileSync(snapshotsPath, "utf-8")
      );
      for (const [publicId, text] of Object.entries(snapshots)) {
        await memorySnapshotStore.saveSnapshot({
          workspaceId: ctx.workspaceId,
          runId: "demo_run",
          url: "https://example.com/demo",
          text,
          sourceId: publicId.split("/").pop(),
        });
      }
    }

    // Read run fixture counts
    const runPath = path.join(fixtureDir, "run.json");
    let runCounts = {
      sourcesFound: 5,
      sourcesFetched: 3,
      valuesExtracted: 25,
      valuesRejected: 2,
      recordsKept: 5,
      duplicatesMerged: 1,
      verified: 4,
      unverified: 1,
    };

    if (fs.existsSync(runPath)) {
      const runFixture = JSON.parse(fs.readFileSync(runPath, "utf-8"));
      if (runFixture.counts) {
        runCounts = { ...runCounts, ...runFixture.counts };
      }
    }

    const run = await runsRepo.create(ctx.workspaceId, {
      workflowId: workflow.id,
      status: "complete",
      stage: "complete",
      counts: runCounts,
      startedAt: new Date(Date.now() - 60000),
      finishedAt: new Date(),
      cursor: { isDemo: true },
    });

    // Update workflow with latestRunId
    await workflowsRepo.update(ctx.workspaceId, workflow.id, {
      latestRunId: run.id,
      status: "completed",
    });

    // Seed sources
    const sourcesPath = path.join(fixtureDir, "sources.json");
    const sourceIdMap: Record<string, string> = {};
    const createdSources = [];

    if (fs.existsSync(sourcesPath)) {
      const fixtureSources = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));
      for (const src of fixtureSources) {
        const originalId = src.id || src._id;
        const created = await sourcesRepo.create(ctx.workspaceId, {
          runId: run.id,
          url: src.url,
          domain: src.domain,
          title: src.title,
          discoveredVia: src.discoveredVia || "search",
          robots: src.robots || { allowed: true, checkedAt: new Date() },
          status: src.status || "fetched",
          httpStatus: src.httpStatus || 200,
          textLength: src.textLength || 1000,
          snapshot: src.snapshot,
          fetchedAt: src.fetchedAt ? new Date(src.fetchedAt) : new Date(),
        });
        if (originalId) {
          sourceIdMap[originalId] = created.id;
        }
        createdSources.push(created);
      }
    }

    // Seed records
    const recordsPath = path.join(fixtureDir, "records.json");
    if (fs.existsSync(recordsPath)) {
      const fixtureRecords = JSON.parse(fs.readFileSync(recordsPath, "utf-8"));
      for (const rec of fixtureRecords) {
        // Remap sourceIds in receipts to actual created sources
        const remappedReceipts: Record<string, unknown> = {};
        if (rec.receipts) {
          for (const [fKey, rVal] of Object.entries(rec.receipts as Record<string, { sourceId?: string }>)) {
            const mappedSrcId = (rVal.sourceId && sourceIdMap[rVal.sourceId]) || createdSources[0]?.id || "src_demo";
            remappedReceipts[fKey] = {
              ...rVal,
              sourceId: mappedSrcId,
            };
          }
        }

        await recordsRepo.create(ctx.workspaceId, {
          runId: run.id,
          workflowId: workflow.id,
          fingerprint: rec.fingerprint || `fp_${Math.random()}`,
          values: rec.values || {},
          receipts: remappedReceipts as Record<string, Receipt>,
          rowConfidence: rec.rowConfidence ?? 0.95,
          flags: rec.flags || [],
          mergedFrom: rec.mergedFrom || [],
        });
      }
    }

    return jsonResponse({ workflow, run }, ctx, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}