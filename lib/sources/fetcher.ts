import { isDomainPermitted, type PolicyCheckOptions } from "./policy";
import type { RobotsChecker } from "./robots";
import type { DomainRateLimiter } from "./rateLimit";

export class PolicyViolationError extends Error {
  readonly url: string;
  constructor(message: string, url: string) {
    super(`Policy violation for ${url}: ${message}`);
    this.name = "PolicyViolationError";
    this.url = url;
  }
}

export class RobotsDisallowedError extends Error {
  readonly url: string;
  constructor(message: string, url: string) {
    super(`Robots disallowed: ${message}`);
    this.name = "RobotsDisallowedError";
    this.url = url;
  }
}

export class SizeLimitExceededError extends Error {
  readonly limitBytes: number;
  readonly actualBytes?: number;
  constructor(limitBytes: number, actualBytes?: number) {
    super(
      `Response size exceeded limit of ${limitBytes} bytes${
        actualBytes ? ` (received ${actualBytes} bytes)` : ""
      }`
    );
    this.name = "SizeLimitExceededError";
    this.limitBytes = limitBytes;
    this.actualBytes = actualBytes;
  }
}

export class InvalidContentTypeError extends Error {
  readonly contentType: string;
  constructor(contentType: string) {
    super(`Invalid Content-Type '${contentType}'. Only HTML and plain text are accepted.`);
    this.name = "InvalidContentTypeError";
    this.contentType = contentType;
  }
}

export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Fetch timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class MaxRedirectsError extends Error {
  readonly maxRedirects: number;
  constructor(maxRedirects: number) {
    super(`Exceeded maximum allowed redirects (${maxRedirects})`);
    this.name = "MaxRedirectsError";
    this.maxRedirects = maxRedirects;
  }
}

export class FetchError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

export interface FetchPageOptions extends PolicyCheckOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
  rateLimiter?: DomainRateLimiter;
  robotsChecker?: RobotsChecker;
  fetchFn?: typeof fetch;
}

export interface FetchPageResult {
  status: number;
  finalUrl: string;
  html: string;
  contentType: string;
}

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_USER_AGENT = "CairnBot/1.0";

/**
 * Validates whether the Content-Type header corresponds to HTML or plain text.
 */
function isValidContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase().trim();
  return (
    lower.includes("text/html") ||
    lower.includes("application/xhtml+xml") ||
    lower.includes("text/plain")
  );
}

/**
 * Fetches a web page safely according to Cairn collection policy:
 * - Checks domain allowlist, denylist, and SSRF restrictions before each hop
 * - Follows up to 3 redirects, re-validating policy on every target
 * - Caps response size to 2 MB
 * - Restricts to HTML and plain text content
 * - Enforces request timeout
 * - Uses CairnBot user agent
 */
export async function fetchPage(
  initialUrl: string,
  options: FetchPageOptions = {}
): Promise<FetchPageResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchFn = options.fetchFn ?? fetch;

  let currentUrl = initialUrl.trim();
  let redirectCount = 0;

  while (true) {
    // 1. Re-check policy before making request (including on redirect hops)
    const policyResult = isDomainPermitted(currentUrl, {
      allowlist: options.allowlist,
      denylist: options.denylist,
    });

    if (!policyResult.permitted) {
      throw new PolicyViolationError(policyResult.reason || "Domain forbidden", currentUrl);
    }

    // 2. Check robots.txt if checker provided
    if (options.robotsChecker) {
      const robotsResult = await options.robotsChecker.isAllowed(currentUrl, userAgent);
      if (!robotsResult.allowed) {
        throw new RobotsDisallowedError(robotsResult.reason || "Disallowed by robots.txt", currentUrl);
      }
    }

    // 3. Acquire rate limit permit if rateLimiter provided
    if (options.rateLimiter) {
      await options.rateLimiter.acquire(currentUrl);
    }

    // 4. Execute fetch with timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetchFn(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new FetchTimeoutError(timeoutMs);
      }
      throw error;
    }

    clearTimeout(timeoutId);

    // 5. Handle redirects
    if (REDIRECT_STATUS_CODES.has(response.status)) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new MaxRedirectsError(maxRedirects);
      }

      const locationHeader = response.headers.get("location");
      if (!locationHeader) {
        throw new FetchError(`Redirect status ${response.status} returned without Location header`, response.status);
      }

      try {
        const nextUrl = new URL(locationHeader, currentUrl).href;
        currentUrl = nextUrl;
        continue;
      } catch {
        throw new FetchError(`Invalid redirect Location: ${locationHeader}`, response.status);
      }
    }

    // 6. Non-redirect response: Validate Content-Type
    const contentType = response.headers.get("content-type") || "";
    if (!isValidContentType(contentType)) {
      throw new InvalidContentTypeError(contentType);
    }

    // 7. Validate Content-Length header if present
    const declaredLength = response.headers.get("content-length");
    if (declaredLength) {
      const parsedLength = parseInt(declaredLength, 10);
      if (!Number.isNaN(parsedLength) && parsedLength > maxSizeBytes) {
        throw new SizeLimitExceededError(maxSizeBytes, parsedLength);
      }
    }

    // 8. Stream / read body with size enforcement
    let html: string;
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > maxSizeBytes) {
              await reader.cancel();
              throw new SizeLimitExceededError(maxSizeBytes, totalBytes);
            }
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }

      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const decoder = new TextDecoder("utf-8");
      html = decoder.decode(merged);
    } else {
      const rawText = await response.text();
      const byteLength = Buffer.byteLength(rawText, "utf-8");
      if (byteLength > maxSizeBytes) {
        throw new SizeLimitExceededError(maxSizeBytes, byteLength);
      }
      html = rawText;
    }

    return {
      status: response.status,
      finalUrl: currentUrl,
      html,
      contentType,
    };
  }
}
