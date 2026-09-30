export interface PolicyCheckOptions {
  allowlist?: string[];
  denylist?: string[];
}

export interface PolicyCheckResult {
  permitted: boolean;
  reason?: string;
  normalizedUrl?: string;
  hostname?: string;
}

export const DEFAULT_DENYLIST = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
] as const;

/**
 * Checks whether an IP or hostname belongs to a private, loopback, or link-local range.
 */
export function isPrivateIp(ipOrHost: string): boolean {
  const clean = ipOrHost.trim().toLowerCase().replace(/^\[|\]$/g, "");

  if (
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }

  // IPv4 Private Class A (10.0.0.0/8)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }

  // IPv4 Private Class B (172.16.0.0/12: 172.16.0.0 to 172.31.255.255)
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }

  // IPv4 Private Class C (192.168.0.0/16)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }

  // IPv4 Link-Local / Cloud Metadata (169.254.0.0/16)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }

  // IPv4 Broadcast / Current Network (0.0.0.0/8)
  if (/^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }

  // IPv6 Loopback and Unspecified
  if (clean === "::1" || clean === "::" || clean === "0:0:0:0:0:0:0:1" || clean === "0:0:0:0:0:0:0:0") {
    return true;
  }

  // IPv6 Unique Local Address (fc00::/7 -> fc.. or fd..)
  if (/^f[cd][0-9a-f]{2}:/i.test(clean)) {
    return true;
  }

  // IPv6 Link-Local (fe80::/10 -> fe8, fe9, fea, feb)
  if (/^fe[89ab][0-9a-f]:/i.test(clean)) {
    return true;
  }

  // IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (clean.startsWith("::ffff:")) {
    const rem = clean.replace("::ffff:", "");
    if (rem.includes(".")) {
      return isPrivateIp(rem);
    }
    const parts = rem.split(":");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const high = parseInt(parts[0], 16);
      const low = parseInt(parts[1], 16);
      const dotted = [
        (high >> 8) & 0xff,
        high & 0xff,
        (low >> 8) & 0xff,
        low & 0xff,
      ].join(".");
      return isPrivateIp(dotted);
    }
  }

  return false;
}

/**
 * Checks whether a given hostname matches any domain in a target list,
 * matching either exactly or as a subdomain.
 */
export function matchesDomainList(hostname: string, domainList: readonly string[] | string[]): boolean {
  const normHost = hostname.trim().toLowerCase();
  for (const rawDomain of domainList) {
    const normDomain = rawDomain.trim().toLowerCase();
    if (normHost === normDomain || normHost.endsWith(`.${normDomain}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Pure policy validator. Checks protocol, SSRF targets, denylist, and allowlist.
 */
export function isDomainPermitted(
  urlInput: string,
  options: PolicyCheckOptions = {}
): PolicyCheckResult {
  if (!urlInput || typeof urlInput !== "string" || !urlInput.trim()) {
    return { permitted: false, reason: "URL string cannot be empty" };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlInput.trim());
  } catch {
    return { permitted: false, reason: "Invalid URL format" };
  }

  // Enforce HTTP / HTTPS protocol
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      permitted: false,
      reason: `Only HTTP and HTTPS protocols are permitted (received ${parsed.protocol})`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { permitted: false, reason: "URL must contain a valid hostname" };
  }

  // SSRF Protection: localhost, loopback, private ranges, link-local metadata
  if (isPrivateIp(hostname)) {
    return {
      permitted: false,
      reason: `Access to localhost and private IP addresses is prohibited (${hostname})`,
      hostname,
    };
  }

  // Check denylist (default denylist + custom denylist)
  const fullDenylist = [...DEFAULT_DENYLIST, ...(options.denylist || [])];
  if (matchesDomainList(hostname, fullDenylist)) {
    return {
      permitted: false,
      reason: `Domain ${hostname} is on the denylist`,
      hostname,
    };
  }

  // Check allowlist if specified and non-empty
  if (options.allowlist && options.allowlist.length > 0) {
    if (!matchesDomainList(hostname, options.allowlist)) {
      return {
        permitted: false,
        reason: `Domain ${hostname} is not in the permitted allowlist`,
        hostname,
      };
    }
  }

  return {
    permitted: true,
    normalizedUrl: parsed.href,
    hostname,
  };
}
