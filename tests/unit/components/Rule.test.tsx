import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Rule } from "@/components/ui/Rule";

describe("Rule Primitive", () => {
  it("renders hairline horizontal separator rule", () => {
    const { container } = render(<Rule />);
    const hr = container.querySelector("hr");
    expect(hr).toBeInTheDocument();
    expect(hr).toHaveClass("border-rule");
    expect(hr).toHaveAttribute("role", "separator");
  });

  it("renders vertical orientation when requested", () => {
    const { container } = render(<Rule orientation="vertical" />);
    const div = container.querySelector("div");
    expect(div).toBeInTheDocument();
    expect(div).toHaveClass("border-l");
    expect(div).toHaveAttribute("role", "separator");
  });
});
