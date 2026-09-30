export interface RateLimiterOptions {
  capacity: number;
  refillRatePerSecond: number;
  clock?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRatePerSecond: number;
  private clock: () => number;
  private buckets = new Map<string, BucketState>();

  constructor(options: RateLimiterOptions) {
    this.capacity = options.capacity;
    this.refillRatePerSecond = options.refillRatePerSecond;
    this.clock = options.clock ?? Date.now;
  }

  consume(id: string, count = 1): RateLimitResult {
    const now = this.clock();
    let state = this.buckets.get(id);

    if (!state) {
      state = {
        tokens: this.capacity,
        lastRefill: now,
      };
      this.buckets.set(id, state);
    } else {
      // Refill tokens based on elapsed time
      const elapsedSeconds = (now - state.lastRefill) / 1000;
      if (elapsedSeconds > 0) {
        state.tokens = Math.min(this.capacity, state.tokens + elapsedSeconds * this.refillRatePerSecond);
        state.lastRefill = now;
      }
    }

    if (state.tokens >= count) {
      state.tokens -= count;
      return { allowed: true };
    }

    const needed = count - state.tokens;
    const retryAfterSeconds = Math.ceil(needed / this.refillRatePerSecond);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

// Global default rate limiter for blueprint requests: 10 capacity, 1 per 2 seconds (0.5/sec)
export const blueprintRateLimiter = new TokenBucketRateLimiter({
  capacity: 10,
  refillRatePerSecond: 0.5,
});

export function checkBlueprintRateLimit(identifier: string): RateLimitResult {
  return blueprintRateLimiter.consume(identifier);
}

export function resetRateLimiter(): void {
  blueprintRateLimiter.reset();
}
