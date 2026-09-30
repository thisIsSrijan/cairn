import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptDrawer } from "@/components/results/ReceiptDrawer";
import { ExportSheet } from "@/components/results/ExportSheet";
import type { RecordDoc } from "@/lib/db/schemas";

describe("ReceiptDrawer Component", () => {
  const mockRecord: RecordDoc & { id: string } = {
    id: "rec_456",
    workspaceId: "ws_test",
    runId: "run_test",
    workflowId: "wf_test",
    fingerprint: "fp_456",
    values: {
      role: "Staff Engineer",
      salary: "$210,000",
    },
    receipts: {
      role: {
        sourceId: "src_1",
        evidence: "Staff Engineer opening in platform team",
        confidence: 0.96,
        extractedAt: new Date("2026-09-30T10:30:00Z"),
        validator: { status: "verified", notes: null },
      },
    },
    rowConfidence: 0.96,
    flags: [],
    mergedFrom: [],
    createdAt: new Date("2026-09-30T10:30:00Z"),
  };

  const mockReceiptDetail = {
    receipt: mockRecord.receipts.role,
    location: { start: 20, end: 58 },
    window: {
      prefix: "We are actively seeking a ",
      match: "Staff Engineer opening in platform team",
      suffix: " with distributed systems experience.",
      text: "We are actively seeking a Staff Engineer opening in platform team with distributed systems experience.",
    },
    source: {
      id: "src_1",
      url: "https://careers.stripe.com/jobs/123",
      domain: "careers.stripe.com",
      title: "Careers at Stripe",
      fetchedAt: new Date("2026-09-30T10:29:00Z"),
    },
  };

  it("renders field name, value, verdict badge, confidence, and source URL", () => {
    render(
      <ReceiptDrawer
        open={true}
        onClose={vi.fn()}
        record={mockRecord}
        field="role"
        receiptDetail={mockReceiptDetail}
        loading={false}
      />
    );

    expect(screen.getByText("role")).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("verified").length).toBeGreaterThan(0);
    expect(screen.getByText(/96%/)).toBeInTheDocument();
    expect(screen.getByText("careers.stripe.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open source/i })).toHaveAttribute(
      "href",
      "https://careers.stripe.com/jobs/123"
    );
  });

  it("highlights verbatim quote in snapshot window using signal underline, not yellow highlight", () => {
    render(
      <ReceiptDrawer
        open={true}
        onClose={vi.fn()}
        record={mockRecord}
        field="role"
        receiptDetail={mockReceiptDetail}
        loading={false}
      />
    );

    const mark = screen.getByText("Staff Engineer opening in platform team");
    expect(mark.tagName.toLowerCase()).toBe("mark");
    // Verifies signal color styling and strictly no yellow highlighter classes
    expect(mark.className).toContain("border-b-2");
    expect(mark.className).toContain("border-signal");
    expect(mark.className).not.toContain("bg-yellow");
  });

  it("renders numbered trail motif when record has merged receipts", () => {
    const mergedRecord: RecordDoc & { id: string } = {
      ...mockRecord,
      mergedFrom: ["src_2", "src_3"],
      receipts: {
        role: {
          sourceId: "src_1",
          evidence: "Staff Engineer opening in platform team",
          confidence: 0.96,
          extractedAt: new Date("2026-09-30T10:30:00Z"),
          validator: { status: "verified", notes: null },
        },
        "role__corroborated_1": {
          sourceId: "src_2",
          evidence: "Staff Engineer platform team needed",
          confidence: 0.91,
          extractedAt: new Date("2026-09-30T10:31:00Z"),
          validator: { status: "verified", notes: null },
        },
      },
    };

    render(
      <ReceiptDrawer
        open={true}
        onClose={vi.fn()}
        record={mergedRecord}
        field="role"
        receiptDetail={mockReceiptDetail}
        loading={false}
      />
    );

    expect(screen.getByText("Corroboration Trail")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("renders side-by-side contradiction view when field is contradicted", () => {
    const contradictedRecord: RecordDoc & { id: string } = {
      ...mockRecord,
      flags: ["contradiction_salary"],
      values: {
        salary: "$180,000",
      },
      receipts: {
        salary: {
          sourceId: "src_1",
          evidence: "Salary range begins at $180,000",
          confidence: 0.85,
          extractedAt: new Date("2026-09-30T10:30:00Z"),
          validator: { status: "contradicted", notes: "Conflicting evidence from secondary source" },
        },
        salary__conflict_1: {
          sourceId: "src_2",
          evidence: "Compensation listed as $220,000 base",
          confidence: 0.82,
          extractedAt: new Date("2026-09-30T10:31:00Z"),
          validator: { status: "contradicted", notes: "Differs from primary source" },
        },
      },
    };

    render(
      <ReceiptDrawer
        open={true}
        onClose={vi.fn()}
        record={contradictedRecord}
        field="salary"
        receiptDetail={{
          ...mockReceiptDetail,
          receipt: contradictedRecord.receipts.salary,
        }}
        loading={false}
      />
    );

    expect(screen.getByText(/Contradiction Flagged/i)).toBeInTheDocument();
    expect(screen.getByText("Salary range begins at $180,000")).toBeInTheDocument();
    expect(screen.getByText("Compensation listed as $220,000 base")).toBeInTheDocument();
  });
});

describe("ExportSheet Component", () => {
  it("renders format options and provenance notice", () => {
    render(
      <ExportSheet
        open={true}
        onClose={vi.fn()}
        runId="run_123"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("Export Dataset")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
    expect(
      screen.getByText(/Every field includes a corresponding provenance source URL column/i)
    ).toBeInTheDocument();
  });

  it("handles export execution, displays progress, and offers download and copy link buttons", async () => {
    const onExport = vi.fn().mockResolvedValue({
      id: "exp_1",
      format: "csv",
      url: "/api/exports/exp_1/download",
      rows: 25,
    });

    render(
      <ExportSheet
        open={true}
        onClose={vi.fn()}
        runId="run_123"
        onExport={onExport}
      />
    );

    const exportBtn = screen.getByRole("button", { name: /generate export/i });
    fireEvent.click(exportBtn);

    expect(screen.getByText(/compiling ledger export/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /download csv/i })).toHaveAttribute(
        "href",
        "/api/exports/exp_1/download"
      );
      expect(screen.getByRole("button", { name: /copy download link/i })).toBeInTheDocument();
    });
  });
});
