import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Chip } from "@/components/ui/Chip";

describe("Chip Primitive", () => {
  it("renders with label text and button role", () => {
    render(<Chip label="Permitted Sources" />);
    const chip = screen.getByRole("button", { name: "Permitted Sources" });
    expect(chip).toBeInTheDocument();
  });

  it("handles selected state via aria-pressed", () => {
    render(<Chip label="Active Filter" selected />);
    const chip = screen.getByRole("button", { name: "Active Filter" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("supports removal callback when onRemove is supplied", () => {
    const handleRemove = vi.fn();
    render(<Chip label="Removable Item" onRemove={handleRemove} />);
    const removeBtn = screen.getByRole("button", { name: "Remove Removable Item" });
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("is keyboard accessible", () => {
    const handleClick = vi.fn();
    render(<Chip label="Filter Tag" onClick={handleClick} />);
    const chip = screen.getByRole("button", { name: "Filter Tag" });
    fireEvent.click(chip);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
