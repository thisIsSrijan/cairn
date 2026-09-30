import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { RobotsCache, checkRobotsAllowed } from "@/lib/sources/robots";

describe("Robots compliance checker", () => {
  let fetchCounts: Record<string, number> = {};

  const server = setupServer(
    http.get("https://standard.com/robots.txt", () => {
      fetchCounts["standard.com"] = (fetchCounts["standard.com"] || 0) + 1;
      const robotsTxt = [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /private/",
        "Allow: /public",
        "",
        "User-agent: CairnBot",
        "Disallow: /cairn-blocked/",
        "Disallow: /admin",
      ].join("\n");
      return HttpResponse.text(robotsTxt, { status: 200 });
    }),

    http.get("https://notfound.com/robots.txt", () => {
      fetchCounts["notfound.com"] = (fetchCounts["notfound.com"] || 0) + 1;
      return new HttpResponse("Not Found", { status: 404 });
    }),

    http.get("https://servererror.com/robots.txt", () => {
      fetchCounts["servererror.com"] = (fetchCounts["servererror.com"] || 0) + 1;
      return new HttpResponse("Internal Server Error", { status: 500 });
    }),

    http.get("https://forbidden.com/robots.txt", () => {
      fetchCounts["forbidden.com"] = (fetchCounts["forbidden.com"] || 0) + 1;
      return new HttpResponse("Forbidden", { status: 403 });
    }),

    http.get("https://networkdrop.com/robots.txt", () => {
      fetchCounts["networkdrop.com"] = (fetchCounts["networkdrop.com"] || 0) + 1;
      return HttpResponse.error();
    })
  );

  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    fetchCounts = {};
  });
  afterAll(() => server.close());

  it("permits allowed paths and blocks disallowed paths according to robots.txt", async () => {
    const robots = new RobotsCache();

    const allowed = await robots.isAllowed("https://standard.com/jobs/openings");
    expect(allowed.allowed).toBe(true);

    const blockedGeneral = await robots.isAllowed("https://standard.com/admin/settings");
    expect(blockedGeneral.allowed).toBe(false);
    expect(blockedGeneral.reason).toContain("robots.txt");

    const blockedBot = await robots.isAllowed("https://standard.com/cairn-blocked/test");
    expect(blockedBot.allowed).toBe(false);
  });

  it("caches parsed robots.txt per domain across multiple checks", async () => {
    const robots = new RobotsCache();

    await robots.isAllowed("https://standard.com/page1");
    await robots.isAllowed("https://standard.com/page2");
    await robots.isAllowed("https://standard.com/page3");

    expect(fetchCounts["standard.com"]).toBe(1);
  });

  it("re-fetches robots.txt after clearCache()", async () => {
    const robots = new RobotsCache();
    await robots.isAllowed("https://standard.com/page1");
    expect(fetchCounts["standard.com"]).toBe(1);

    robots.clearCache();
    await robots.isAllowed("https://standard.com/page2");
    expect(fetchCounts["standard.com"]).toBe(2);
  });

  it("handles malformed or invalid URLs cleanly", async () => {
    const robots = new RobotsCache();
    const result = await robots.isAllowed("not-a-valid-url");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Invalid");
  });

  it("treats 404 status as allowed (no robots restrictions)", async () => {
    const robots = new RobotsCache();

    const result = await robots.isAllowed("https://notfound.com/restricted/path");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();

    // Subsequent call should also use cache
    await robots.isAllowed("https://notfound.com/another/path");
    expect(fetchCounts["notfound.com"]).toBe(1);
  });

  it("treats 500 server error as disallowed for safety", async () => {
    const robots = new RobotsCache();

    const result = await robots.isAllowed("https://servererror.com/content");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("500");
  });

  it("treats 403 forbidden as disallowed for safety", async () => {
    const robots = new RobotsCache();

    const result = await robots.isAllowed("https://forbidden.com/content");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("403");
  });

  it("treats network errors as disallowed for safety", async () => {
    const robots = new RobotsCache();

    const result = await robots.isAllowed("https://networkdrop.com/content");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/network|fetch failed|error/i);
  });

  it("checkRobotsAllowed works with default singleton instance", async () => {
    const result = await checkRobotsAllowed("https://notfound.com/default-cache-test");
    expect(result.allowed).toBe(true);
  });
});
