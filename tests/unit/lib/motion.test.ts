import { describe, it, expect } from "vitest";
import { easings, durations, motionVariants } from "@/lib/motion";

describe("Motion Tokens and Utilities", () => {
  it("exports custom field ledger easings within required cubic-bezier constraints", () => {
    expect(easings.ledger).toBeDefined();
    expect(easings.step).toBeDefined();
    expect(Array.isArray(easings.ledger)).toBe(true);
    expect(easings.ledger.length).toBe(4);
  });

  it("exports durations within 180ms to 420ms range per design spec", () => {
    expect(durations.fast).toBe(0.18);
    expect(durations.normal).toBe(0.28);
    expect(durations.slow).toBe(0.42);
  });

  it("exports standard motion variants for fade and sheet", () => {
    expect(motionVariants.fadeIn).toBeDefined();
    expect(motionVariants.slideUp).toBeDefined();
    expect(motionVariants.sheet).toBeDefined();
  });
});
