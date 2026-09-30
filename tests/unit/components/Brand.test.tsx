import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CairnMark } from "@/components/brand/CairnMark";
import { CairnWordmark } from "@/components/brand/CairnWordmark";

describe("Brand Components", () => {
  describe("CairnMark", () => {
    it("renders SVG with exactly specified geometry elements", () => {
      const { container } = render(<CairnMark className="w-8 h-8" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("viewBox", "0 0 64 64");

      // Verify bottom stone: rect x=7 y=43 w=50 h=14 rx=7
      const bottomRect = container.querySelector('rect[x="7"][y="43"][width="50"][height="14"][rx="7"]');
      expect(bottomRect).toBeInTheDocument();

      // Verify middle stone: rect x=16 y=26 w=33 h=13 rx=6.5 rotated -3 about 32 32
      const middleRect = container.querySelector('rect[x="16"][y="26"][width="33"][height="13"]');
      expect(middleRect).toBeInTheDocument();
      expect(middleRect).toHaveAttribute("rx", "6.5");
      expect(middleRect?.getAttribute("transform")).toContain("rotate(-3 32 32)");

      // Verify top stone: circle cx=33 cy=13 r=7 with signal fill
      const circle = container.querySelector('circle[cx="33"][cy="13"][r="7"]');
      expect(circle).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<CairnMark className="custom-mark-class" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("custom-mark-class");
    });
  });

  describe("CairnWordmark", () => {
    it("renders lowercase cairn with Fraunces font styling and tight tracking", () => {
      render(<CairnWordmark />);
      const wordmark = screen.getByText("cairn");
      expect(wordmark).toBeInTheDocument();
      expect(wordmark.tagName.toLowerCase()).toBe("span");
      expect(wordmark.className).toContain("font-display");
      expect(wordmark.className).toContain("tracking-tight");
    });
  });
});
