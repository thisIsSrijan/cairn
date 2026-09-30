export interface RateLimiterOptions {
  minDelayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractDomainKey(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim().toLowerCase();
  try {
    if (trimmed.includes("://")) {
      const parsed = new URL(trimmed);
      return parsed.hostname.toLowerCase();
    }
  } catch {
    // Fall back to clean string
  }
  return trimmed.split("/")[0] || trimmed;
}

export class DomainRateLimiter {
  private minDelayMs: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private lastScheduledTimes = new Map<string, number>();

  constructor(options: RateLimiterOptions = {}) {
    this.minDelayMs = options.minDelayMs ?? 1000;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  clear(): void {
    this.lastScheduledTimes.clear();
  }

  /**
   * Acquires a permit to make a request to the target domain.
   * Staggers calls to the same domain by at least minDelayMs.
   * Returns the duration waited in milliseconds.
   */
  async acquire(domainOrUrl: string): Promise<number> {
    const domain = extractDomainKey(domainOrUrl);
    const currentTime = this.now();
    const lastTime = this.lastScheduledTimes.get(domain) ?? 0;

    let scheduledTime: number;
    let waitMs: number;

    if (currentTime >= lastTime + this.minDelayMs) {
      scheduledTime = currentTime;
      waitMs = 0;
    } else {
      scheduledTime = lastTime + this.minDelayMs;
      waitMs = scheduledTime - currentTime;
    }

    this.lastScheduledTimes.set(domain, scheduledTime);

    if (waitMs > 0) {
      await this.sleep(waitMs);
    }

    return waitMs;
  }

  /**
   * Schedules an asynchronous task respecting the per-domain rate limit.
   */
  async schedule<T>(domainOrUrl: string, task: () => Promise<T>): Promise<T> {
    await this.acquire(domainOrUrl);
    return task();
  }
}

export const defaultRateLimiter = new DomainRateLimiter();
