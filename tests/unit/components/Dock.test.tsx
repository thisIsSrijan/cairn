import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Dock } from "@/components/ui/Dock";

describe("Dock Primitive", () => {
  it("renders navigation landmark with aria-label", () => {
    render(<Dock activeTab="ask" onSelectTab={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
  });

  it("renders exactly the three destinations: Ask, Tasks, Datasets", () => {
    render(<Dock activeTab="ask" onSelectTab={() => {}} />);
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Datasets" })).toBeInTheDocument();
  });

  it("indicates current active tab via aria-current or data-active", () => {
    render(<Dock activeTab="tasks" onSelectTab={() => {}} />);
    const tasksButton = screen.getByRole("button", { name: "Tasks" });
    expect(tasksButton).toHaveAttribute("aria-current", "page");
  });
});
