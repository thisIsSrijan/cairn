import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Stat } from "@/components/ui/Stat";

describe("Stat Primitive", () => {
  it("renders uppercase tracked mono label and tabular number", () => {
    render(<Stat label="Verified Records" value={142} />);
    const label = screen.getByText("Verified Records");
    const value = screen.getByText("142");

    expect(label).toHaveClass("font-mono");
    expect(label).toHaveClass("uppercase");
    expect(value).toHaveClass("tabular-nums");
    expect(value).toHaveClass("font-mono");
  });

  it("supports unit suffix or prefix", () => {
    render(<Stat label="Match Rate" value={98} suffix="%" />);
    expect(screen.getByText("98")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });
});
