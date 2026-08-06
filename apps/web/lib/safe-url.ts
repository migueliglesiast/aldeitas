/**
 * Guards outbound requests against SSRF: only https URLs pointing at an
 * explicit allowlist of booking-platform domains are accepted.
 */

export const ALLOWED_HOSTS = ["airbnb.com", "guesty.com", "booking.com"] as const;

export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 127) return true; // this-network, loopback
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // unique local
  if (host.startsWith("fe80")) return true; // link-local
  if (host.startsWith("::ffff:")) return isPrivateIpv4(host.slice("::ffff:".length));
  return false;
}

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

/**
 * Throws when the URL must not be fetched from the server.
 * Returns the parsed URL when it is safe.
 */
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Host is not allowed");
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error("Host is not allowed");
  }
  if (url.username || url.password) {
    throw new Error("Credentials in URL are not allowed");
  }
  if (!isAllowedHost(hostname)) {
    throw new Error("Host is not in the allowlist");
  }

  return url;
}

export function isSafeUrl(rawUrl: string): boolean {
  try {
    assertSafeUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
