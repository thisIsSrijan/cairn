import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "@/components/ui/Badge";

describe("Badge Primitive", () => {
  it("renders verified status variant", () => {
    render(<Badge variant="verified">Verified Receipt</Badge>);
    const badge = screen.getByText("Verified Receipt");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("role", "status");
    expect(badge.className).toContain("text-verified");
  });

  it("renders caution status variant", () => {
    render(<Badge variant="caution">Partial Match</Badge>);
    const badge = screen.getByText("Partial Match");
    expect(badge.className).toContain("text-caution");
  });

  it("renders reject status variant", () => {
    render(<Badge variant="reject">Quote Discrepancy</Badge>);
    const badge = screen.getByText("Quote Discrepancy");
    expect(badge.className).toContain("text-reject");
  });

  it("renders neutral status variant by default", () => {
    render(<Badge>Pending Verification</Badge>);
    const badge = screen.getByText("Pending Verification");
    expect(badge.className).toContain("font-mono");
  });
});
