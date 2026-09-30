import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CairnBuilder } from "@/components/run/CairnBuilder";
import type { RunStage } from "@/lib/db/schemas";

describe("CairnBuilder Component", () => {
  it("renders SVG stack with 8 stage stones", () => {
    render(<CairnBuilder currentStage="extracting" />);

    const cairn = screen.getByRole("img", { name: /Cairn stage stack/i });
    expect(cairn).toBeInTheDocument();

    // Verify all 8 stages are present in the SVG
    const stages: RunStage[] = [
      "planning",
      "discovering",
      "fetching",
      "extracting",
      "validating",
      "deduping",
      "verifying",
      "complete",
    ];

    for (const stage of stages) {
      expect(screen.getByTestId(`cairn-stone-${stage}`)).toBeInTheDocument();
    }
  });

  it("marks past stages as completed and current stage as active", () => {
    render(<CairnBuilder currentStage="validating" />);

    // Completed stages before validating: planning, discovering, fetching, extracting
    expect(screen.getByTestId("cairn-stone-planning")).toHaveAttribute("data-status", "completed");
    expect(screen.getByTestId("cairn-stone-fetching")).toHaveAttribute("data-status", "completed");
    expect(screen.getByTestId("cairn-stone-extracting")).toHaveAttribute("data-status", "completed");

    // Current stage
    expect(screen.getByTestId("cairn-stone-validating")).toHaveAttribute("data-status", "active");

    // Upcoming stage
    expect(screen.getByTestId("cairn-stone-verifying")).toHaveAttribute("data-status", "upcoming");
    expect(screen.getByTestId("cairn-stone-complete")).toHaveAttribute("data-status", "upcoming");
  });

  it("renders final signal stone as settled when complete", () => {
    render(<CairnBuilder currentStage="complete" isComplete={true} />);

    const completeStone = screen.getByTestId("cairn-stone-complete");
    expect(completeStone).toHaveAttribute("data-status", "completed");
  });
});
