import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sheet } from "@/components/ui/Sheet";

describe("Sheet Primitive", () => {
  it("renders when open is true, displaying dialog and title", () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Receipt Inspection">
        <div>Receipt details body</div>
      </Sheet>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Receipt Inspection")).toBeInTheDocument();
    expect(screen.getByText("Receipt details body")).toBeInTheDocument();
  });

  it("does not render contents when open is false", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Receipt Inspection">
        <div>Receipt details body</div>
      </Sheet>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked or Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Sheet open={true} onClose={handleClose} title="Receipt Inspection">
        <div>Content</div>
      </Sheet>
    );

    const closeBtn = screen.getByRole("button", { name: "Close sheet" });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
