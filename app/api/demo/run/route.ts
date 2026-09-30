import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { WorkflowsRepo, RunsRepo } from "@/lib/db/repos";

export async function GET(req: NextRequest) {
  try {
    if (process.env.DEMO_MODE !== "true") {
      return errorResponse("DEMO_MODE_DISABLED", "Demo mode is disabled", 403);
    }

    const ctx = extractWorkspaceId(req);
    const db = await getDb();
    const workflowsRepo = new WorkflowsRepo(db);
    const runsRepo = new RunsRepo(db);

    const fixturePath = path.resolve(process.cwd(), "tests/fixtures/demo/workflow.json");
    let blueprintData;
    let prompt = "job openings for junior developers in Lucknow";
    let title = "Junior Developers in Lucknow";

    if (fs.existsSync(fixturePath)) {
      const recorded = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
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

    const run = await runsRepo.create(ctx.workspaceId, {
      workflowId: workflow.id,
      status: "queued",
      stage: "planning",
      cursor: { isDemo: true },
    });

    return jsonResponse(
      {
        workflow,
        run,
      },
      ctx,
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}