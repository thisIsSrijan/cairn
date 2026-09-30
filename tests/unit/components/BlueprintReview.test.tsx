import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlueprintReview } from "@/components/blueprint/BlueprintReview";
import type { Blueprint } from "@/lib/db/schemas";

const mockBlueprint: Blueprint = {
  intent: "Collect junior developer job listings in Lucknow",
  entity: "Job Opening",
  fields: [
    { key: "title", label: "Job Title", type: "string", required: true, description: "" },
    { key: "company", label: "Company", type: "string", required: true, description: "" },
    { key: "salary", label: "Salary", type: "string", required: false, description: "" },
  ],
  keyFields: ["title", "company"],
  sources: [
    { kind: "search", query: "junior developer jobs lucknow" },
    { kind: "url", url: "https://example.com/jobs" },
  ],
  limits: {
    maxSources: 6,
    maxRecords: 25,
  },
};

describe("BlueprintReview Component", () => {
  it("renders skeleton loader when loading is true", () => {
    render(
      <BlueprintReview
        open={true}
        loading={true}
        blueprint={null}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Planning blueprint/i)).toBeInTheDocument();
  });

  it("renders blueprint details when loaded", () => {
    render(
      <BlueprintReview
        open={true}
        loading={false}
        blueprint={mockBlueprint}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByText("Job Opening")).toBeInTheDocument();
    expect(screen.getByText(/Job Title/i)).toBeInTheDocument();
    expect(screen.getByText(/Company/i)).toBeInTheDocument();
    expect(screen.getByText(/Salary/i)).toBeInTheDocument();
    expect(screen.getByText("junior developer jobs lucknow")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/jobs")).toBeInTheDocument();
  });

  it("allows renaming a field label and toggling required status", () => {
    render(
      <BlueprintReview
        open={true}
        loading={false}
        blueprint={mockBlueprint}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    // Click edit on Salary field
    const editSalaryBtn = screen.getByRole("button", { name: /Edit Salary/i });
    fireEvent.click(editSalaryBtn);

    // Rename label
    const labelInput = screen.getByLabelText(/Field Label/i);
    fireEvent.change(labelInput, { target: { value: "Compensation Package" } });

    // Toggle required
    const requiredToggle = screen.getByLabelText(/Required/i);
    fireEvent.click(requiredToggle);

    // Save
    const saveBtn = screen.getByRole("button", { name: /Save field/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Compensation Package/i)).toBeInTheDocument();
  });

  it("allows removing a field", () => {
    render(
      <BlueprintReview
        open={true}
        loading={false}
        blueprint={mockBlueprint}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    const removeSalaryBtn = screen.getByRole("button", { name: /Remove Salary/i });
    fireEvent.click(removeSalaryBtn);

    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
  });

  it("adjusts limits with steppers", () => {
    render(
      <BlueprintReview
        open={true}
        loading={false}
        blueprint={mockBlueprint}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    const incSourcesBtn = screen.getByRole("button", { name: /Increase max sources/i });
    fireEvent.click(incSourcesBtn);
    expect(screen.getByText("7")).toBeInTheDocument();

    const decRecordsBtn = screen.getByRole("button", { name: /Decrease max records/i });
    fireEvent.click(decRecordsBtn);
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("renders refusal state with rationale and refused categories", () => {
    const refusal = {
      refused: true as const,
      reason: "Requests for private personal telephone numbers are not permitted.",
      refusedCategories: ["Personal Contact Information"],
    };

    render(
      <BlueprintReview
        open={true}
        loading={false}
        blueprint={null}
        refusal={refusal}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByText(/Request Refused/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Requests for private personal telephone numbers are not permitted/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Personal Contact Information")).toBeInTheDocument();
  });

  it("calls onStart with modified blueprint when Start collecting is clicked", () => {
    const onStart = vi.fn();
    render(
      <BlueprintReview
        open={true}
        loading={false}
        blueprint={mockBlueprint}
        onClose={vi.fn()}
        onStart={onStart}
      />
    );

    const startBtn = screen.getByRole("button", { name: /Start collecting/i });
    fireEvent.click(startBtn);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "Job Opening",
        limits: expect.objectContaining({ maxSources: 6, maxRecords: 25 }),
      })
    );
  });
});
