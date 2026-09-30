import { describe, it, expect } from "vitest";
import { generateContours, generateTrailWithWaypoints } from "@/lib/art/contours";

describe("Topographic Contours Generator", () => {
  it("produces deterministic SVG path strings for the same seed and parameters", () => {
    const params = {
      seed: 42,
      width: 800,
      height: 400,
      contourCount: 5,
    };

    const run1 = generateContours(params);
    const run2 = generateContours(params);

    expect(run1.length).toBe(5);
    expect(run1).toEqual(run2);
  });

  it("produces different SVG path strings for different seeds", () => {
    const params1 = { seed: 101, width: 800, height: 400, contourCount: 4 };
    const params2 = { seed: 202, width: 800, height: 400, contourCount: 4 };

    const run1 = generateContours(params1);
    const run2 = generateContours(params2);

    expect(run1).not.toEqual(run2);
  });

  it("generates closed SVG paths ending with Z", () => {
    const paths = generateContours({
      seed: 777,
      width: 600,
      height: 300,
      contourCount: 3,
    });

    for (const p of paths) {
      expect(p.startsWith("M")).toBe(true);
      expect(p.trim().endsWith("Z")).toBe(true);
    }
  });

  it("generates a trail path and exactly 3 waypoints within bounds", () => {
    const width = 800;
    const height = 400;
    const trail = generateTrailWithWaypoints({ seed: 42, width, height });

    expect(trail.path.startsWith("M")).toBe(true);
    expect(trail.waypoints).toHaveLength(3);

    for (const wp of trail.waypoints) {
      expect(wp.x).toBeGreaterThanOrEqual(0);
      expect(wp.x).toBeLessThanOrEqual(width);
      expect(wp.y).toBeGreaterThanOrEqual(0);
      expect(wp.y).toBeLessThanOrEqual(height);
      expect(wp.label).toBeTruthy();
    }
  });
});
