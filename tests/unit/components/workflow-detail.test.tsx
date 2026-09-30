/**
 * Unit tests for WorkflowDetail component.
 * Tests: blueprint readonly display, run trail rendering, re-run action.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkflowDetail } from "@/components/workflow/WorkflowDetail";
import type { Workflow, Run } from "@/lib/db/schemas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockWorkflow: Workflow & { id: string } = {
  id: "wf_test_1",
  workspaceId: "ws_test",
  title: "Junior Developers in Lucknow",
  prompt: "job openings for junior developers in Lucknow",
  blueprint: {
    intent: "Discover open junior software developer positions in Lucknow",
    entity: "JobOpening",
    fields: [
      {
        key: "job_title",
        label: "Job Title",
        type: "string",
        required: true,
        description: "Title of the role",
      },
      {
        key: "company_name",
        label: "Company Name",
        type: "string",
        required: true,
        description: "Name of the hiring organisation",
      },
    ],
    keyFields: ["job_title", "company_name"],
    sources: [{ kind: "search", query: "junior developer jobs Lucknow" }],
    limits: { maxSources: 8, maxRecords: 30 },
  },
  status: "completed",
  latestRunId: "run_latest_1",
  createdAt: new Date("2026-09-30T10:00:00Z"),
  updatedAt: new Date("2026-09-30T14:00:00Z"),
};

const mockRuns: (Run & { id: string })[] = [
  {
    id: "run_latest_1",
    workspaceId: "ws_test",
    workflowId: "wf_test_1",
    status: "complete",
    stage: "complete",
    cursor: {},
    counts: {
      sourcesFound: 5,
      sourcesFetched: 5,
      valuesExtracted: 25,
      valuesRejected: 2,
      recordsKept: 10,
      duplicatesMerged: 1,
      verified: 9,
      unverified: 1,
    },
    error: null,
    startedAt: new Date("2026-09-30T14:00:00Z"),
    finishedAt: new Date("2026-09-30T14:02:00Z"),
    previousRunId: "run_prev_1",
    createdAt: new Date("2026-09-30T14:00:00Z"),
  },
  {
    id: "run_prev_1",
    workspaceId: "ws_test",
    workflowId: "wf_test_1",
    status: "complete",
    stage: "complete",
    cursor: {},
    counts: {
      sourcesFound: 4,
      sourcesFetched: 4,
      valuesExtracted: 20,
      valuesRejected: 1,
      recordsKept: 8,
      duplicatesMerged: 0,
      verified: 8,
      unverified: 0,
    },
    error: null,
    startedAt: new Date("2026-09-29T10:00:00Z"),
    finishedAt: new Date("2026-09-29T10:02:00Z"),
    previousRunId: null,
    createdAt: new Date("2026-09-29T10:00:00Z"),
  },
];

describe("WorkflowDetail", () => {
  it("renders workflow title and entity", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={vi.fn()}
        runningId={null}
      />
    );

    expect(screen.getByText("Junior Developers in Lucknow")).toBeInTheDocument();
    expect(screen.getByText(/JobOpening/)).toBeInTheDocument();
  });

  it("renders blueprint fields in read-only mode", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={vi.fn()}
        runningId={null}
      />
    );

    expect(screen.getByText("Job Title")).toBeInTheDocument();
    expect(screen.getByText("Company Name")).toBeInTheDocument();
  });

  it("renders run trail with stone markers for each run", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={vi.fn()}
        runningId={null}
      />
    );

    // Two runs should appear in the trail
    const trailItems = screen.getAllByRole("listitem");
    expect(trailItems.length).toBeGreaterThanOrEqual(2);
  });

  it("renders Run again primary action button", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={vi.fn()}
        runningId={null}
      />
    );

    expect(
      screen.getByRole("button", { name: /run again/i })
    ).toBeInTheDocument();
  });

  it("calls onRunAgain when Run again is clicked", () => {
    const onRunAgain = vi.fn();
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={onRunAgain}
        runningId={null}
      />
    );

    screen.getByRole("button", { name: /run again/i }).click();
    expect(onRunAgain).toHaveBeenCalled();
  });

  it("shows loading state when runningId matches workflow id", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={vi.fn()}
        runningId={"wf_test_1"}
      />
    );

    const runAgainBtn = screen.getByRole("button", { name: /run again/i });
    expect(runAgainBtn).toBeDisabled();
  });

  it("marks the latest run with a highlighted stone marker", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={mockRuns}
        onRunAgain={vi.fn()}
        runningId={null}
      />
    );

    // The latest run marker has data-latest attribute
    expect(screen.getByTestId("run-trail-marker-latest")).toBeInTheDocument();
  });

  it("renders empty run trail with empty state illustration when no runs", () => {
    render(
      <WorkflowDetail
        workflow={mockWorkflow}
        runs={[]}
        onRunAgain={vi.fn()}
        runningId={null}
      />
    );

    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });
});
