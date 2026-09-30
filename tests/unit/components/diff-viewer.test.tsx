/**
 * Unit tests for DiffViewer component.
 * Tests: grouped sections render, empty state, field-level before/after values,
 * summary counts, receipt link triggers.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DiffViewer } from "@/components/diff/DiffViewer";
import type { RunDiffResult } from "@/lib/pipeline/diff";

const makeRecord = (
  id: string,
  fingerprint: string,
  values: Record<string, unknown>
) => ({
  id,
  fingerprint,
  workspaceId: "ws_test",
  runId: "run_1",
  workflowId: "wf_1",
  values,
  receipts: {},
  rowConfidence: 0.9,
  flags: [],
  mergedFrom: [],
  createdAt: new Date("2026-09-30T00:00:00Z"),
});

const ADDED_RECORD = makeRecord("rec_add_1", "fp_add_1", {
  job_title: "Backend Engineer",
  company_name: "Apex Systems",
});

const REMOVED_RECORD = makeRecord("rec_rem_1", "fp_rem_1", {
  job_title: "Frontend Developer",
  company_name: "Nexus Labs",
});

const CHANGED_CURRENT = makeRecord("rec_chg_1", "fp_chg_1", {
  job_title: "Senior Software Engineer",
  salary_range: "15 to 20 LPA",
});

const CHANGED_PREVIOUS = makeRecord("rec_chg_1_prev", "fp_chg_1", {
  job_title: "Software Engineer",
  salary_range: "10 to 14 LPA",
});

const fullDiff: RunDiffResult = {
  runId: "run_current",
  previousRunId: "run_previous",
  summary: { added: 1, removed: 1, changed: 1 },
  added: [ADDED_RECORD],
  removed: [REMOVED_RECORD],
  changed: [
    {
      current: CHANGED_CURRENT,
      previous: CHANGED_PREVIOUS,
      changes: {
        job_title: {
          previous: "Software Engineer",
          current: "Senior Software Engineer",
        },
        salary_range: {
          previous: "10 to 14 LPA",
          current: "15 to 20 LPA",
        },
      },
    },
  ],
};

const emptyDiff: RunDiffResult = {
  runId: "run_current",
  previousRunId: "run_previous",
  summary: { added: 0, removed: 0, changed: 0 },
  added: [],
  removed: [],
  changed: [],
};

const noPreviousDiff: RunDiffResult = {
  runId: "run_current",
  previousRunId: null,
  summary: { added: 2, removed: 0, changed: 0 },
  added: [ADDED_RECORD, REMOVED_RECORD],
  removed: [],
  changed: [],
};

const fields = [
  { key: "job_title", label: "Job Title" },
  { key: "company_name", label: "Company Name" },
  { key: "salary_range", label: "Salary Range" },
];

describe("DiffViewer", () => {
  it("renders summary rule with correct counts", () => {
    render(
      <DiffViewer
        diff={fullDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    // Summary strip: +1 -1 ~1
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText(/-1/)).toBeInTheDocument();
    expect(screen.getByText(/~1/)).toBeInTheDocument();
  });

  it("renders Added section with record values", () => {
    render(
      <DiffViewer
        diff={fullDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    const addedSection = screen.getByRole("region", { name: /added/i });
    expect(within(addedSection).getByText("Backend Engineer")).toBeInTheDocument();
    expect(within(addedSection).getByText("Apex Systems")).toBeInTheDocument();
  });

  it("renders Removed section with record values", () => {
    render(
      <DiffViewer
        diff={fullDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    const removedSection = screen.getByRole("region", { name: /removed/i });
    expect(within(removedSection).getByText("Frontend Developer")).toBeInTheDocument();
    expect(within(removedSection).getByText("Nexus Labs")).toBeInTheDocument();
  });

  it("renders Changed section with before and after values", () => {
    render(
      <DiffViewer
        diff={fullDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    const changedSection = screen.getByRole("region", { name: /changed/i });

    // Before values
    expect(within(changedSection).getByText("Software Engineer")).toBeInTheDocument();
    expect(within(changedSection).getByText("10 to 14 LPA")).toBeInTheDocument();

    // After values
    expect(within(changedSection).getByText("Senior Software Engineer")).toBeInTheDocument();
    expect(within(changedSection).getByText("15 to 20 LPA")).toBeInTheDocument();
  });

  it("calls onSelectReceipt when receipt button clicked in added section", async () => {
    const onSelectReceipt = vi.fn();
    render(
      <DiffViewer
        diff={fullDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={onSelectReceipt}
      />
    );

    const addedSection = screen.getByRole("region", { name: /added/i });
    const receiptBtns = within(addedSection).getAllByRole("button");
    if (receiptBtns.length > 0) {
      receiptBtns[0].click();
      expect(onSelectReceipt).toHaveBeenCalled();
    }
  });

  it("renders no-changes empty state when summary is all zero", () => {
    render(
      <DiffViewer
        diff={emptyDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
    // No Added / Removed / Changed sections should be shown
    expect(screen.queryByRole("region", { name: /added/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /removed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /changed/i })).not.toBeInTheDocument();
  });

  it("renders first-run state when previousRunId is null", () => {
    render(
      <DiffViewer
        diff={noPreviousDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    expect(screen.getByText(/first run/i)).toBeInTheDocument();
  });

  it("renders field labels from fields prop in Changed section", () => {
    render(
      <DiffViewer
        diff={fullDiff}
        fields={fields}
        workflowId="wf_1"
        runId="run_current"
        onSelectReceipt={vi.fn()}
      />
    );

    const changedSection = screen.getByRole("region", { name: /changed/i });
    expect(within(changedSection).getByText("Job Title")).toBeInTheDocument();
    expect(within(changedSection).getByText("Salary Range")).toBeInTheDocument();
  });
});
