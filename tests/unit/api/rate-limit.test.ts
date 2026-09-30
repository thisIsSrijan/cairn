import { describe, it, expect, beforeEach } from "vitest";
import { TokenBucketRateLimiter } from "@/lib/api/rateLimit";

describe("TokenBucketRateLimiter", () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    // 3 tokens capacity, refill 1 token every 1000ms
    limiter = new TokenBucketRateLimiter({
      capacity: 3,
      refillRatePerSecond: 1,
    });
  });

  it("allows bursts within capacity", () => {
    const id = "test_user_1";
    expect(limiter.consume(id).allowed).toBe(true);
    expect(limiter.consume(id).allowed).toBe(true);
    expect(limiter.consume(id).allowed).toBe(true);
    // 4th request must be rejected
    const check4 = limiter.consume(id);
    expect(check4.allowed).toBe(false);
    expect(check4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks rate limits per client identifier", () => {
    expect(limiter.consume("user_a").allowed).toBe(true);
    expect(limiter.consume("user_a").allowed).toBe(true);
    expect(limiter.consume("user_a").allowed).toBe(true);
    expect(limiter.consume("user_a").allowed).toBe(false);

    // user_b still has fresh bucket
    expect(limiter.consume("user_b").allowed).toBe(true);
  });

  it("refills tokens over time", () => {
    let mockTime = 1000;
    const timeLimiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillRatePerSecond: 1,
      clock: () => mockTime,
    });

    expect(timeLimiter.consume("user_c").allowed).toBe(true);
    expect(timeLimiter.consume("user_c").allowed).toBe(true);
    expect(timeLimiter.consume("user_c").allowed).toBe(false);

    // Advance 1 second: 1 token refilled
    mockTime += 1000;
    expect(timeLimiter.consume("user_c").allowed).toBe(true);
    expect(timeLimiter.consume("user_c").allowed).toBe(false);
  });

  it("allows resetting limiter state", () => {
    limiter.consume("user_d");
    limiter.consume("user_d");
    limiter.consume("user_d");
    expect(limiter.consume("user_d").allowed).toBe(false);

    limiter.reset();
    expect(limiter.consume("user_d").allowed).toBe(true);
  });
});
