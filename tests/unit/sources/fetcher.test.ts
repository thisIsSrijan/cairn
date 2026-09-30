import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  fetchPage,
  FetchTimeoutError,
  SizeLimitExceededError,
  InvalidContentTypeError,
  MaxRedirectsError,
  PolicyViolationError,
  RobotsDisallowedError,
  FetchError,
} from "@/lib/sources/fetcher";
import { DomainRateLimiter } from "@/lib/sources/rateLimit";
import type { RobotsChecker } from "@/lib/sources/robots";

describe("Source fetcher", () => {
  let capturedHeaders: Headers[] = [];

  const server = setupServer(
    http.get("https://web.org/success", ({ request }) => {
      capturedHeaders.push(request.headers);
      return new HttpResponse("<html><body><h1>Hello World</h1></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }),

    http.get("https://web.org/plain", () => {
      return new HttpResponse("Simple plaintext content", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }),

    http.get("https://web.org/pdf", () => {
      return new HttpResponse("fake-pdf-binary", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    }),

    http.get("https://web.org/json", () => {
      return HttpResponse.json({ data: 123 });
    }),

    // Redirect hops
    http.get("https://web.org/redirect-1", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "https://web.org/redirect-2" },
      });
    }),
    http.get("https://web.org/redirect-2", () => {
      return new HttpResponse(null, {
        status: 301,
        headers: { Location: "https://web.org/redirect-3" },
      });
    }),
    http.get("https://web.org/redirect-3", () => {
      return new HttpResponse(null, {
        status: 307,
        headers: { Location: "https://web.org/final-dest" },
      });
    }),
    http.get("https://web.org/final-dest", () => {
      return new HttpResponse("<html><body>Final Hop</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),

    // Redirect with missing Location header
    http.get("https://web.org/redirect-no-location", () => {
      return new HttpResponse(null, {
        status: 302,
      });
    }),

    // Infinite redirect loop
    http.get("https://web.org/loop-1", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "https://web.org/loop-2" },
      });
    }),
    http.get("https://web.org/loop-2", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "https://web.org/loop-3" },
      });
    }),
    http.get("https://web.org/loop-3", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "https://web.org/loop-4" },
      });
    }),
    http.get("https://web.org/loop-4", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "https://web.org/loop-5" },
      });
    }),

    // Redirect to SSRF private target
    http.get("https://web.org/redirect-ssrf", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1:8000/internal" },
      });
    }),

    // Redirect to denylisted domain
    http.get("https://web.org/redirect-denied", () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: "https://linkedin.com/jobs/view" },
      });
    }),

    // Oversized response (declared Content-Length > 2MB)
    http.get("https://web.org/oversized-header", () => {
      return new HttpResponse("small payload", {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Content-Length": String(3 * 1024 * 1024),
        },
      });
    }),

    // Oversized response body
    http.get("https://web.org/oversized-body", () => {
      const largeChunk = "A".repeat(1024 * 1024 * 2 + 100);
      return new HttpResponse(largeChunk, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),

    // Slow hanging endpoint for timeout testing
    http.get("https://web.org/slow", async () => {
      await new Promise((r) => setTimeout(r, 200));
      return new HttpResponse("<html><body>Slow</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    })
  );

  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    capturedHeaders = [];
  });
  afterAll(() => server.close());

  it("fetches valid HTML page with CairnBot user agent", async () => {
    const result = await fetchPage("https://web.org/success");
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe("https://web.org/success");
    expect(result.html).toContain("Hello World");
    expect(result.contentType).toContain("text/html");

    expect(capturedHeaders.length).toBeGreaterThan(0);
    expect(capturedHeaders[0]?.get("User-Agent")).toBe("CairnBot/1.0");
  });

  it("fetches plain text document", async () => {
    const result = await fetchPage("https://web.org/plain");
    expect(result.status).toBe(200);
    expect(result.html).toBe("Simple plaintext content");
  });

  it("rejects non-html and non-plain-text Content-Types", async () => {
    await expect(fetchPage("https://web.org/pdf")).rejects.toThrow(InvalidContentTypeError);
    await expect(fetchPage("https://web.org/json")).rejects.toThrow(InvalidContentTypeError);
  });

  it("follows up to 3 redirects and resolves finalUrl", async () => {
    const result = await fetchPage("https://web.org/redirect-1");
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe("https://web.org/final-dest");
    expect(result.html).toContain("Final Hop");
  });

  it("aborts when redirect count exceeds 3 hops", async () => {
    await expect(fetchPage("https://web.org/loop-1")).rejects.toThrow(MaxRedirectsError);
  });

  it("re-evaluates policy on each redirect hop and blocks SSRF targets", async () => {
    await expect(fetchPage("https://web.org/redirect-ssrf")).rejects.toThrow(PolicyViolationError);
  });

  it("re-evaluates policy on each redirect hop and blocks denylisted domains", async () => {
    await expect(fetchPage("https://web.org/redirect-denied")).rejects.toThrow(PolicyViolationError);
  });

  it("throws FetchError on redirect without Location header", async () => {
    await expect(fetchPage("https://web.org/redirect-no-location")).rejects.toThrow(FetchError);
  });

  it("rejects response when Content-Length header exceeds 2MB", async () => {
    await expect(fetchPage("https://web.org/oversized-header")).rejects.toThrow(
      SizeLimitExceededError
    );
  });

  it("rejects response when body size exceeds 2MB limit", async () => {
    await expect(fetchPage("https://web.org/oversized-body")).rejects.toThrow(
      SizeLimitExceededError
    );
  });

  it("aborts when fetch exceeds timeout threshold", async () => {
    await expect(
      fetchPage("https://web.org/slow", { timeoutMs: 50 })
    ).rejects.toThrow(FetchTimeoutError);
  });

  it("integrates with robotsChecker and blocks disallowed urls", async () => {
    const mockRobots: RobotsChecker = {
      isAllowed: async (url) => ({
        allowed: !url.includes("blocked"),
        reason: "Robots denied",
      }),
      clearCache: () => {},
    };

    await expect(
      fetchPage("https://web.org/blocked-path", { robotsChecker: mockRobots })
    ).rejects.toThrow(RobotsDisallowedError);

    const allowed = await fetchPage("https://web.org/success", { robotsChecker: mockRobots });
    expect(allowed.status).toBe(200);
  });

  it("integrates with rateLimiter to meter requests", async () => {
    let acquireCalled = false;
    const mockLimiter = new DomainRateLimiter({
      now: () => 1000,
      sleep: async () => {},
    });
    const origAcquire = mockLimiter.acquire.bind(mockLimiter);
    mockLimiter.acquire = async (url) => {
      acquireCalled = true;
      return origAcquire(url);
    };

    const result = await fetchPage("https://web.org/success", { rateLimiter: mockLimiter });
    expect(result.status).toBe(200);
    expect(acquireCalled).toBe(true);
  });

  it("handles non-streamed response body and enforces size limits", async () => {
    const customFetch = async () => {
      return {
        status: 200,
        headers: new Headers({ "Content-Type": "text/html" }),
        body: null, // No stream reader
        text: async () => "<html><body>Non-streamed content</body></html>",
      } as unknown as Response;
    };

    const result = await fetchPage("https://web.org/custom", { fetchFn: customFetch });
    expect(result.html).toContain("Non-streamed content");

    const oversizedFetch = async () => {
      return {
        status: 200,
        headers: new Headers({ "Content-Type": "text/html" }),
        body: null,
        text: async () => "X".repeat(2 * 1024 * 1024 + 10),
      } as unknown as Response;
    };

    await expect(
      fetchPage("https://web.org/custom-oversized", { fetchFn: oversizedFetch })
    ).rejects.toThrow(SizeLimitExceededError);
  });
});
