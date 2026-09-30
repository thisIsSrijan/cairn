import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SummaryStrip } from "@/components/results/SummaryStrip";
import { FilterBar, type FilterState } from "@/components/results/FilterBar";
import { SpecimenCard } from "@/components/results/SpecimenCard";
import { RecordsTable } from "@/components/results/RecordsTable";
import type { RecordDoc, RunCounts } from "@/lib/db/schemas";

describe("SummaryStrip Component", () => {
  const mockCounts: RunCounts = {
    sourcesFound: 10,
    sourcesFetched: 8,
    valuesExtracted: 40,
    valuesRejected: 5,
    recordsKept: 12,
    duplicatesMerged: 3,
    verified: 9,
    unverified: 3,
  };

  it("renders records kept, duplicates merged, and rejected counts", () => {
    render(<SummaryStrip counts={mockCounts} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Records Kept")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Duplicates Merged")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Rejected Values")).toBeInTheDocument();
  });

  it("renders segmented rule with verified percentage share", () => {
    render(<SummaryStrip counts={mockCounts} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText(/75% verified/i)).toBeInTheDocument();
  });
});

describe("FilterBar Component", () => {
  const defaultFilters: FilterState = {
    search: "",
    status: "all",
    minConfidence: 0,
    sourceDomain: "",
    fieldPresence: "",
  };

  const fields = [
    { key: "company", label: "Company" },
    { key: "role", label: "Role" },
    { key: "salary", label: "Salary" },
  ];

  const domains = ["careers.acme.com", "jobs.example.org"];

  it("handles debounced search input changes", async () => {
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        filters={defaultFilters}
        fields={fields}
        domains={domains}
        onFilterChange={onFilterChange}
      />
    );

    const input = screen.getByPlaceholderText(/search records/i);
    fireEvent.change(input, { target: { value: "engineer" } });

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: "engineer" })
      );
    });
  });

  it("changes status filter when option is chosen", () => {
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        filters={defaultFilters}
        fields={fields}
        domains={domains}
        onFilterChange={onFilterChange}
      />
    );

    const verifiedBtn = screen.getByRole("button", { name: /^verified$/i });
    fireEvent.click(verifiedBtn);

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "verified" })
    );
  });

  it("updates minimum confidence filter on slider change", () => {
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        filters={defaultFilters}
        fields={fields}
        domains={domains}
        onFilterChange={onFilterChange}
      />
    );

    const slider = screen.getByRole("slider", { name: /minimum confidence/i });
    fireEvent.change(slider, { target: { value: "0.8" } });

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ minConfidence: 0.8 })
    );
  });

  it("selects domain and field presence filters", () => {
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        filters={defaultFilters}
        fields={fields}
        domains={domains}
        onFilterChange={onFilterChange}
      />
    );

    const domainSelect = screen.getByRole("combobox", { name: /source domain/i });
    fireEvent.change(domainSelect, { target: { value: "careers.acme.com" } });
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDomain: "careers.acme.com" })
    );

    const fieldSelect = screen.getByRole("combobox", { name: /field presence/i });
    fireEvent.change(fieldSelect, { target: { value: "salary" } });
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ fieldPresence: "salary" })
    );
  });
});

describe("SpecimenCard Component (Mobile view)", () => {
  const mockRecord: RecordDoc & { id: string } = {
    id: "rec_123",
    workspaceId: "ws_test",
    runId: "run_test",
    workflowId: "wf_test",
    fingerprint: "fp_123",
    values: {
      role: "Lead Engineer",
      company: "Acme Corp",
      salary: "$160,000",
    },
    receipts: {
      role: {
        sourceId: "src_1",
        evidence: "Lead Engineer opening",
        confidence: 0.94,
        extractedAt: new Date("2026-09-30T12:00:00Z"),
        validator: { status: "verified", notes: null },
      },
      company: {
        sourceId: "src_1",
        evidence: "Acme Corp is hiring",
        confidence: 0.92,
        extractedAt: new Date("2026-09-30T12:00:00Z"),
        validator: { status: "verified", notes: null },
      },
    },
    rowConfidence: 0.93,
    flags: [],
    mergedFrom: ["src_2"],
    createdAt: new Date("2026-09-30T12:00:00Z"),
  };

  const fields = [
    { key: "role", label: "Role" },
    { key: "company", label: "Company" },
    { key: "salary", label: "Salary" },
  ];

  it("renders entity title, domain chip, and key-value pairs with verification marks", () => {
    const onSelectReceipt = vi.fn();
    render(
      <SpecimenCard
        record={mockRecord}
        fields={fields}
        keyField="role"
        sourceDomain="acme.com"
        onSelectReceipt={onSelectReceipt}
      />
    );

    expect(screen.getAllByText("Lead Engineer").length).toBeGreaterThan(0);
    expect(screen.getByText("acme.com")).toBeInTheDocument();
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("triggers onSelectReceipt when any field value button is pressed", () => {
    const onSelectReceipt = vi.fn();
    render(
      <SpecimenCard
        record={mockRecord}
        fields={fields}
        keyField="role"
        sourceDomain="acme.com"
        onSelectReceipt={onSelectReceipt}
      />
    );

    const valBtn = screen.getByRole("button", { name: /view receipt for company: Acme Corp/i });
    fireEvent.click(valBtn);

    expect(onSelectReceipt).toHaveBeenCalledWith(mockRecord, "company");
  });
});

describe("RecordsTable Component (Desktop view)", () => {
  const records: (RecordDoc & { id: string })[] = [
    {
      id: "rec_1",
      workspaceId: "ws_test",
      runId: "run_test",
      workflowId: "wf_test",
      fingerprint: "fp_1",
      values: { role: "Backend Lead", company: "Stripe" },
      receipts: {
        role: {
          sourceId: "src_1",
          evidence: "Backend Lead",
          confidence: 0.95,
          extractedAt: new Date(),
          validator: { status: "verified", notes: null },
        },
      },
      rowConfidence: 0.95,
      flags: [],
      mergedFrom: [],
      createdAt: new Date(),
    },
  ];

  const fields = [
    { key: "role", label: "Role" },
    { key: "company", label: "Company" },
  ];

  it("renders table headers, rows, and cell buttons", () => {
    const onSelectReceipt = vi.fn();
    const onSortChange = vi.fn();

    render(
      <RecordsTable
        records={records}
        fields={fields}
        sourceDomains={{ src_1: "stripe.com" }}
        sort="confidence_desc"
        onSortChange={onSortChange}
        onSelectReceipt={onSelectReceipt}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Company")).toBeInTheDocument();

    const cellBtn = screen.getByRole("button", { name: /view receipt for role: Backend Lead/i });
    fireEvent.click(cellBtn);
    expect(onSelectReceipt).toHaveBeenCalledWith(records[0], "role");
  });
});
