import { describe, it, expect } from "vitest";
import { DomainRateLimiter, defaultRateLimiter } from "@/lib/sources/rateLimit";

describe("DomainRateLimiter", () => {
  it("executes initial request immediately with zero wait", async () => {
    let mockTime = 10000;
    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      now: () => mockTime,
      sleep: async (ms) => {
        mockTime += ms;
      },
    });

    const waitMs = await limiter.acquire("example.com");
    expect(waitMs).toBe(0);
  });

  it("staggers consecutive requests to the same domain by 1 second", async () => {
    let mockTime = 1000;
    const sleptDurations: number[] = [];

    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      now: () => mockTime,
      sleep: async (ms) => {
        sleptDurations.push(ms);
        mockTime += ms;
      },
    });

    // Request 1 at t=1000
    const wait1 = await limiter.acquire("https://site.org/page1");
    expect(wait1).toBe(0);

    // Request 2 immediately at t=1000
    const wait2 = await limiter.acquire("https://site.org/page2");
    expect(wait2).toBe(1000);

    // Request 3 immediately at t=2000
    const wait3 = await limiter.acquire("https://site.org/page3");
    expect(wait3).toBe(1000);

    expect(sleptDurations).toEqual([1000, 1000]);
  });

  it("handles different domains independently without cross-domain delay", async () => {
    let mockTime = 5000;
    const sleptDurations: number[] = [];

    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      now: () => mockTime,
      sleep: async (ms) => {
        sleptDurations.push(ms);
        mockTime += ms;
      },
    });

    const waitA = await limiter.acquire("alpha.com");
    const waitB = await limiter.acquire("beta.org");
    const waitC = await limiter.acquire("gamma.io");

    expect(waitA).toBe(0);
    expect(waitB).toBe(0);
    expect(waitC).toBe(0);
    expect(sleptDurations).toHaveLength(0);
  });

  it("permits immediate request if elapsed time exceeds 1 second", async () => {
    let mockTime = 0;
    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      now: () => mockTime,
      sleep: async (ms) => {
        mockTime += ms;
      },
    });

    await limiter.acquire("domain.com");

    // Advance clock by 2500ms
    mockTime += 2500;

    const waitAfterGap = await limiter.acquire("domain.com");
    expect(waitAfterGap).toBe(0);
  });

  it("resets tracked domain timestamps on clear()", async () => {
    const mockTime = 1000;
    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      now: () => mockTime,
      sleep: async () => {},
    });

    await limiter.acquire("cleared.com");
    limiter.clear();

    const waitAfterClear = await limiter.acquire("cleared.com");
    expect(waitAfterClear).toBe(0);
  });

  it("schedule helper executes action and returns result", async () => {
    let mockTime = 0;
    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      now: () => mockTime,
      sleep: async (ms) => {
        mockTime += ms;
      },
    });

    const result = await limiter.schedule("https://example.com/api", async () => {
      return "ledger-data";
    });

    expect(result).toBe("ledger-data");
  });

  it("functions with default constructor options", async () => {
    const limiter = new DomainRateLimiter({ minDelayMs: 5 });
    const wait1 = await limiter.acquire("real-clock.org");
    expect(wait1).toBe(0);
    const wait2 = await limiter.acquire("real-clock.org");
    expect(wait2).toBeGreaterThanOrEqual(0);

    expect(defaultRateLimiter).toBeInstanceOf(DomainRateLimiter);
  });
});
