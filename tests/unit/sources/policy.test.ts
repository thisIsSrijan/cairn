import { describe, it, expect } from "vitest";
import {
  isDomainPermitted,
  DEFAULT_DENYLIST,
  isPrivateIp,
  matchesDomainList,
} from "@/lib/sources/policy";

describe("Policy checks: isDomainPermitted", () => {
  it("permits standard public HTTP and HTTPS urls", () => {
    const validUrls = [
      "https://example.com/openings",
      "http://news.ycombinator.com",
      "https://github.com/trending",
      "https://sub.domain.co.uk/path?arg=val",
    ];

    for (const url of validUrls) {
      const result = isDomainPermitted(url);
      expect(result.permitted, `Expected ${url} to be permitted`).toBe(true);
      expect(result.reason).toBeUndefined();
    }
  });

  it("rejects non-http(s) protocols", () => {
    const invalidProtocols = [
      "ftp://ftp.example.com/files",
      "file:///etc/passwd",
      "data:text/html,<h1>Hello</h1>",
      "javascript:alert(1)",
      "ws://example.com/socket",
    ];

    for (const url of invalidProtocols) {
      const result = isDomainPermitted(url);
      expect(result.permitted, `Expected ${url} to be rejected`).toBe(false);
      expect(result.reason).toContain("HTTP");
    }
  });

  it("rejects malformed URLs", () => {
    const badUrls = ["not-a-url", "://missing-proto", "", "   "];
    for (const url of badUrls) {
      const result = isDomainPermitted(url);
      expect(result.permitted).toBe(false);
      expect(result.reason).toBeDefined();
    }
  });

  it("rejects localhost and loopback variations", () => {
    const localhostUrls = [
      "http://localhost:3000",
      "http://localhost/path",
      "http://127.0.0.1",
      "http://127.0.0.2:8080",
      "http://127.255.255.255",
      "http://[::1]",
      "http://sub.localhost",
    ];

    for (const url of localhostUrls) {
      const result = isDomainPermitted(url);
      expect(result.permitted, `Expected localhost url ${url} to be blocked`).toBe(false);
      expect(result.reason).toMatch(/localhost|loopback|private/i);
    }
  });

  it("rejects private IPv4 address ranges (SSRF protection)", () => {
    const privateIps = [
      "http://10.0.0.1",
      "http://10.255.255.255",
      "http://172.16.0.1",
      "http://172.24.1.1",
      "http://172.31.255.255",
      "http://192.168.0.1",
      "http://192.168.1.100",
      "http://169.254.169.254", // Cloud metadata
      "http://0.0.0.0",
    ];

    for (const url of privateIps) {
      const result = isDomainPermitted(url);
      expect(result.permitted, `Expected private IP ${url} to be blocked`).toBe(false);
      expect(result.reason).toMatch(/private|metadata/i);
    }
  });

  it("rejects private IPv6 address ranges", () => {
    const privateIpv6 = [
      "http://[fc00::1]",
      "http://[fd12:3456:789a::1]",
      "http://[fe80::1]",
      "http://[::ffff:127.0.0.1]",
    ];

    for (const url of privateIpv6) {
      const result = isDomainPermitted(url);
      expect(result.permitted, `Expected private IPv6 ${url} to be blocked`).toBe(false);
      expect(result.reason).toMatch(/private/i);
    }
  });

  it("enforces default denylist domains and subdomains", () => {
    for (const domain of DEFAULT_DENYLIST) {
      const baseResult = isDomainPermitted(`https://${domain}/path`);
      expect(baseResult.permitted, `Expected ${domain} to be denylisted`).toBe(false);
      expect(baseResult.reason).toContain("denylist");

      const subResult = isDomainPermitted(`https://api.${domain}/path`);
      expect(subResult.permitted, `Expected subdomain of ${domain} to be denylisted`).toBe(false);
      expect(subResult.reason).toContain("denylist");
    }
  });

  it("supports custom denylist additions", () => {
    const result = isDomainPermitted("https://unwanted-data.org/listing", {
      denylist: ["unwanted-data.org"],
    });
    expect(result.permitted).toBe(false);
    expect(result.reason).toContain("denylist");
  });

  it("enforces custom allowlist when provided", () => {
    const options = {
      allowlist: ["acme-jobs.org", "careers.partner.com"],
    };

    const allowed = isDomainPermitted("https://acme-jobs.org/roles", options);
    expect(allowed.permitted).toBe(true);

    const subAllowed = isDomainPermitted("https://engineering.acme-jobs.org/roles", options);
    expect(subAllowed.permitted).toBe(true);

    const disallowed = isDomainPermitted("https://other-site.com/roles", options);
    expect(disallowed.permitted).toBe(false);
    expect(disallowed.reason).toContain("allowlist");
  });

  it("isPrivateIp accurately classifies IP strings", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.5.0.1")).toBe(true);
    expect(isPrivateIp("172.20.10.2")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
    expect(isPrivateIp("example.com")).toBe(false);
  });

  it("matchesDomainList handles exact and subdomain matches", () => {
    expect(matchesDomainList("example.com", ["example.com"])).toBe(true);
    expect(matchesDomainList("sub.example.com", ["example.com"])).toBe(true);
    expect(matchesDomainList("notexample.com", ["example.com"])).toBe(false);
  });
});
