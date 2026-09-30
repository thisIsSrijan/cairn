import { describe, it, expect } from "vitest";
import { computeRunDiff } from "@/lib/pipeline/diff";
import type { RecordDoc, Run } from "@/lib/db/schemas";

describe("computeRunDiff", () => {
  const baseRun: Run & { id: string } = {
    id: "run_2",
    workflowId: "wf_1",
    workspaceId: "ws_1",
    status: "complete",
    stage: "complete",
    cursor: {},
    counts: {
      sourcesFound: 2,
      sourcesFetched: 2,
      valuesExtracted: 4,
      valuesRejected: 0,
      recordsKept: 2,
      duplicatesMerged: 0,
      verified: 2,
      unverified: 0,
    },
    error: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    previousRunId: "run_1",
    createdAt: new Date(),
  };

  const prevRecords: Array<RecordDoc & { id: string }> = [
    {
      id: "rec_prev_1",
      workspaceId: "ws_1",
      runId: "run_1",
      workflowId: "wf_1",
      fingerprint: "fp_shared_unchanged",
      values: { title: "Dev 1", salary: "$50k" },
      receipts: {},
      rowConfidence: 0.9,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
    {
      id: "rec_prev_2",
      workspaceId: "ws_1",
      runId: "run_1",
      workflowId: "wf_1",
      fingerprint: "fp_shared_changed",
      values: { title: "Dev 2", salary: "$60k" },
      receipts: {},
      rowConfidence: 0.85,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
    {
      id: "rec_prev_3",
      workspaceId: "ws_1",
      runId: "run_1",
      workflowId: "wf_1",
      fingerprint: "fp_removed",
      values: { title: "Dev 3", salary: "$70k" },
      receipts: {},
      rowConfidence: 0.8,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
  ];

  const currRecords: Array<RecordDoc & { id: string }> = [
    {
      id: "rec_curr_1",
      workspaceId: "ws_1",
      runId: "run_2",
      workflowId: "wf_1",
      fingerprint: "fp_shared_unchanged",
      values: { title: "Dev 1", salary: "$50k" },
      receipts: {},
      rowConfidence: 0.95,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
    {
      id: "rec_curr_2",
      workspaceId: "ws_1",
      runId: "run_2",
      workflowId: "wf_1",
      fingerprint: "fp_shared_changed",
      values: { title: "Dev 2", salary: "$65k" }, // salary changed
      receipts: {},
      rowConfidence: 0.9,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
    {
      id: "rec_curr_4",
      workspaceId: "ws_1",
      runId: "run_2",
      workflowId: "wf_1",
      fingerprint: "fp_added",
      values: { title: "Dev 4", salary: "$80k" },
      receipts: {},
      rowConfidence: 0.9,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
  ];

  it("returns all records as added when previousRunId is null", () => {
    const firstRun = { ...baseRun, previousRunId: null };
    const diff = computeRunDiff(firstRun, currRecords, []);

    expect(diff.previousRunId).toBeNull();
    expect(diff.summary.added).toBe(3);
    expect(diff.summary.removed).toBe(0);
    expect(diff.summary.changed).toBe(0);
    expect(diff.added).toHaveLength(3);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it("computes added, removed, and field-level changed rows accurately", () => {
    const diff = computeRunDiff(baseRun, currRecords, prevRecords);

    expect(diff.runId).toBe("run_2");
    expect(diff.previousRunId).toBe("run_1");
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.removed).toBe(1);
    expect(diff.summary.changed).toBe(1);

    expect(diff.added[0].fingerprint).toBe("fp_added");
    expect(diff.removed[0].fingerprint).toBe("fp_removed");

    const changedItem = diff.changed[0];
    expect(changedItem.current.fingerprint).toBe("fp_shared_changed");
    expect(changedItem.changes).toEqual({
      salary: {
        previous: "$60k",
        current: "$65k",
      },
    });
  });
});
