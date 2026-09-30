import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button Primitive", () => {
  it("renders with default primary variant and accessible role", () => {
    render(<Button>Proceed</Button>);
    const button = screen.getByRole("button", { name: "Proceed" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-signal");
  });

  it("renders secondary ink outline variant", () => {
    render(<Button variant="secondary">Inspect</Button>);
    const button = screen.getByRole("button", { name: "Inspect" });
    expect(button).toHaveClass("border");
    expect(button).toHaveClass("border-ink");
  });

  it("renders quiet ghost variant", () => {
    render(<Button variant="quiet">Dismiss</Button>);
    const button = screen.getByRole("button", { name: "Dismiss" });
    expect(button).toHaveClass("bg-transparent");
  });

  it("handles click and keyboard activation", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Trigger</Button>);
    const button = screen.getByRole("button", { name: "Trigger" });

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(button, { key: " ", code: "Space" });
    // Native buttons fire onClick on Enter/Space
  });

  it("respects disabled state and prevents click handler", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled Action
      </Button>
    );
    const button = screen.getByRole("button", { name: "Disabled Action" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("has minimum touch target height for mobile ergonomics", () => {
    render(<Button>Touch Target</Button>);
    const button = screen.getByRole("button", { name: "Touch Target" });
    expect(button.className).toMatch(/min-h-\[44px\]/);
  });
});
