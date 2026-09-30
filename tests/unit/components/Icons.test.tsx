import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  IconAsk,
  IconTasks,
  IconDatasets,
  IconSource,
  IconReceipt,
  IconCheck,
  IconCross,
  IconFlag,
  IconPause,
  IconPlay,
  IconStop,
  IconRefresh,
  IconFilter,
  IconSearch,
  IconDownload,
  IconLink,
  IconClock,
  IconPlus,
  IconClose,
  IconChevron,
  IconDiff,
  IconShield,
} from "@/components/icons";

const icons = [
  { name: "IconAsk", Component: IconAsk },
  { name: "IconTasks", Component: IconTasks },
  { name: "IconDatasets", Component: IconDatasets },
  { name: "IconSource", Component: IconSource },
  { name: "IconReceipt", Component: IconReceipt },
  { name: "IconCheck", Component: IconCheck },
  { name: "IconCross", Component: IconCross },
  { name: "IconFlag", Component: IconFlag },
  { name: "IconPause", Component: IconPause },
  { name: "IconPlay", Component: IconPlay },
  { name: "IconStop", Component: IconStop },
  { name: "IconRefresh", Component: IconRefresh },
  { name: "IconFilter", Component: IconFilter },
  { name: "IconSearch", Component: IconSearch },
  { name: "IconDownload", Component: IconDownload },
  { name: "IconLink", Component: IconLink },
  { name: "IconClock", Component: IconClock },
  { name: "IconPlus", Component: IconPlus },
  { name: "IconClose", Component: IconClose },
  { name: "IconChevron", Component: IconChevron },
  { name: "IconDiff", Component: IconDiff },
  { name: "IconShield", Component: IconShield },
];

describe("Custom Icons (24px grid, 1.5px stroke, round caps)", () => {
  it("includes all 22 required icons in the set", () => {
    expect(icons.length).toBe(22);
  });

  icons.forEach(({ name, Component }) => {
    it(`${name} renders standard 24px SVG with 1.5 stroke and round caps`, () => {
      const { container } = render(<Component className="test-icon" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      expect(svg).toHaveAttribute("stroke-width", "1.5");
      expect(svg).toHaveAttribute("stroke-linecap", "round");
      expect(svg).toHaveAttribute("stroke-linejoin", "round");
      expect(svg).toHaveClass("test-icon");
    });
  });
});
