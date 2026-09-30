import robotsParser from "robots-parser";

export interface RobotsCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface RobotsChecker {
  isAllowed(url: string, userAgent?: string): Promise<RobotsCheckResult>;
  clearCache(): void;
}

type CachedRobotsEntry =
  | { type: "allow_all" }
  | { type: "disallow_all"; reason: string }
  | { type: "parser"; parser: ReturnType<typeof robotsParser> };

export class RobotsCache implements RobotsChecker {
  private cache = new Map<string, CachedRobotsEntry>();
  private defaultUserAgent: string;
  private customFetch?: typeof fetch;

  constructor(options: { defaultUserAgent?: string; fetchFn?: typeof fetch } = {}) {
    this.defaultUserAgent = options.defaultUserAgent || "CairnBot/1.0";
    this.customFetch = options.fetchFn;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async isAllowed(url: string, userAgent?: string): Promise<RobotsCheckResult> {
    const targetUa = userAgent || this.defaultUserAgent;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { allowed: false, reason: "Invalid target URL" };
    }

    const origin = parsed.origin;
    let entry = this.cache.get(origin);

    if (!entry) {
      entry = await this.fetchRobots(origin, targetUa);
      this.cache.set(origin, entry);
    }

    if (entry.type === "allow_all") {
      return { allowed: true };
    }

    if (entry.type === "disallow_all") {
      return { allowed: false, reason: entry.reason };
    }

    // Parsed robots.txt
    const isAllowedResult = entry.parser.isAllowed(url, targetUa);
    if (isAllowedResult === false) {
      return {
        allowed: false,
        reason: `Access to ${url} is forbidden by robots.txt for user agent ${targetUa}`,
      };
    }

    return { allowed: true };
  }

  private async fetchRobots(origin: string, userAgent: string): Promise<CachedRobotsEntry> {
    const robotsUrl = `${origin}/robots.txt`;
    const fetchFn = this.customFetch || fetch;

    try {
      const response = await fetchFn(robotsUrl, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(5000),
      });

      if (response.status === 200) {
        const text = await response.text();
        const parser = robotsParser(robotsUrl, text);
        return { type: "parser", parser };
      }

      // Treat 404 as allowed (standard convention: no robots.txt means no crawler restrictions)
      if (response.status === 404) {
        return { type: "allow_all" };
      }

      // Treat all other HTTP errors (401, 403, 500, etc.) as disallowed for crawler safety
      return {
        type: "disallow_all",
        reason: `robots.txt returned HTTP status ${response.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      return {
        type: "disallow_all",
        reason: `robots.txt fetch failed: ${message}`,
      };
    }
  }
}

let defaultRobotsInstance: RobotsCache | null = null;

function getDefaultRobotsInstance(): RobotsCache {
  if (!defaultRobotsInstance) {
    defaultRobotsInstance = new RobotsCache();
  }
  return defaultRobotsInstance;
}

export async function checkRobotsAllowed(
  url: string,
  options?: { userAgent?: string; cache?: RobotsChecker; fetchFn?: typeof fetch }
): Promise<RobotsCheckResult> {
  const checker = options?.cache || (options?.fetchFn ? new RobotsCache({ fetchFn: options.fetchFn }) : getDefaultRobotsInstance());
  return checker.isAllowed(url, options?.userAgent);
}
