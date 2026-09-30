import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  // Workflows
  await db.collection("workflows").createIndex(
    { workspaceId: 1, createdAt: -1 },
    { name: "workflows_workspace_created" }
  );

  // Runs
  await db.collection("runs").createIndex(
    { workspaceId: 1, createdAt: -1 },
    { name: "runs_workspace_created" }
  );
  await db.collection("runs").createIndex(
    { workspaceId: 1, workflowId: 1, createdAt: -1 },
    { name: "runs_workspace_workflow_created" }
  );

  // Sources
  await db.collection("sources").createIndex(
    { workspaceId: 1, createdAt: -1 },
    { name: "sources_workspace_created" }
  );
  await db.collection("sources").createIndex(
    { workspaceId: 1, runId: 1, createdAt: -1 },
    { name: "sources_workspace_run_created" }
  );

  // Records
  await db.collection("records").createIndex(
    { workspaceId: 1, createdAt: -1 },
    { name: "records_workspace_created" }
  );
  await db.collection("records").createIndex(
    { workspaceId: 1, runId: 1, createdAt: -1 },
    { name: "records_workspace_run_created" }
  );
  await db.collection("records").createIndex(
    { runId: 1, fingerprint: 1 },
    { name: "records_run_fingerprint_unique", unique: true }
  );
  await db.collection("records").createIndex(
    { "$**": "text" },
    { name: "records_text_search" }
  );

  // Events
  await db.collection("events").createIndex(
    { workspaceId: 1, createdAt: -1 },
    { name: "events_workspace_created" }
  );
  await db.collection("events").createIndex(
    { workspaceId: 1, runId: 1, ts: -1 },
    { name: "events_workspace_run_ts" }
  );

  // Exports
  await db.collection("exports").createIndex(
    { workspaceId: 1, createdAt: -1 },
    { name: "exports_workspace_created" }
  );
  await db.collection("exports").createIndex(
    { workspaceId: 1, runId: 1, createdAt: -1 },
    { name: "exports_workspace_run_created" }
  );
}
