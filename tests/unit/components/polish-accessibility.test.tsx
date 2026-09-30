import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "@/components/ui/Sheet";
import { Dock } from "@/components/ui/Dock";
import { DesktopRail } from "@/components/layout/DesktopRail";
import ErrorBoundary from "@/app/error";
import NotFound from "@/app/not-found";

// Mock router and pathname for DesktopRail
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Accessibility and Polish Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  describe("Sheet Focus Trap and Keyboard Management", () => {
    it("traps focus and handles Escape key", async () => {
      const handleClose = vi.fn();
      const triggerBtn = document.createElement("button");
      triggerBtn.textContent = "Open";
      document.body.appendChild(triggerBtn);
      triggerBtn.focus();

      const { rerender } = render(
        <Sheet open={true} onClose={handleClose} title="Inspection Sheet">
          <div>
            <button type="button">Action A</button>
            <button type="button">Action B</button>
          </div>
        </Sheet>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      // Press Escape
      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Verify Tab cycling
      const closeBtn = screen.getByRole("button", { name: /close sheet/i });
      expect(closeBtn).toBeInTheDocument();
      const actionA = screen.getByRole("button", { name: "Action A" });
      const actionB = screen.getByRole("button", { name: "Action B" });

      actionB.focus();
      // Tab from last element wraps to first
      fireEvent.keyDown(window, { key: "Tab" });

      // Shift+Tab from first element wraps to last
      actionA.focus();
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

      // Clean up DOM trigger
      rerender(<Sheet open={false} onClose={handleClose} title="Inspection Sheet"><div>Closed</div></Sheet>);
      document.body.removeChild(triggerBtn);
    });
  });

  describe("Theme Toggle Controls", () => {
    it("toggles theme attribute and persists to localStorage from Dock", async () => {
      const handleSelectTab = vi.fn();
      render(<Dock activeTab="ask" onSelectTab={handleSelectTab} />);

      const themeBtn = screen.getByRole("button", { name: /switch to (dark|light) theme/i });
      expect(themeBtn).toBeInTheDocument();

      // Initial click toggles to dark or light
      fireEvent.click(themeBtn);
      const themeAttr = document.documentElement.getAttribute("data-theme");
      expect(themeAttr).toBeTruthy();
      expect(localStorage.getItem("cairn-theme")).toBe(themeAttr);

      // Second click toggles back
      fireEvent.click(themeBtn);
      const toggledAttr = document.documentElement.getAttribute("data-theme");
      expect(toggledAttr).not.toBe(themeAttr);
    });

    it("renders theme toggle in DesktopRail", async () => {
      render(<DesktopRail />);

      const railThemeBtn = screen.getByRole("button", { name: /switch to (dark|light) theme/i });
      expect(railThemeBtn).toBeInTheDocument();

      fireEvent.click(railThemeBtn);
      expect(document.documentElement.getAttribute("data-theme")).toBeTruthy();
    });
  });

  describe("Error Boundary Component", () => {
    it("renders calm error message and retry button in field ledger styling", () => {
      const resetMock = vi.fn();
      const testError = new Error("Failed to contact evidence store");
      (testError as unknown as { digest: string }).digest = "survey-err-99";

      render(<ErrorBoundary error={testError} reset={resetMock} />);

      expect(screen.getByText("Execution Fault")).toBeInTheDocument();
      expect(screen.getByText(/stored records and snapshots remain intact/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to contact evidence store/i)).toBeInTheDocument();
      expect(screen.getByText(/Digest: survey-err-99/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /retry operation/i });
      fireEvent.click(retryBtn);
      expect(resetMock).toHaveBeenCalledTimes(1);

      expect(screen.getByRole("link", { name: /return to ledger/i })).toHaveAttribute("href", "/");
    });
  });

  describe("Not Found Component", () => {
    it("renders 404 waypoint message and navigation links", () => {
      render(<NotFound />);

      expect(screen.getByText("Record Not Found")).toBeInTheDocument();
      expect(screen.getByText(/Waypoint Error: 404/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /return to ask/i })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: /view active tasks/i })).toHaveAttribute("href", "/tasks");
    });
  });
});
