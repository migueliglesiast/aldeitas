/** Hostname helpers shared by middleware (no Prisma). */

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const withoutPort = host.split(":")[0].trim().toLowerCase();
  return withoutPort.replace(/^www\./, "");
}

export function normalizeCustomDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "").replace(/\/$/, "");
  }
}

function portalHostsFromEnv(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);

  for (const entry of process.env.PORTAL_HOSTS?.split(",") ?? []) {
    const normalized = normalizeHost(entry);
    if (normalized) hosts.add(normalized);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      const normalized = normalizeHost(new URL(siteUrl).host);
      if (normalized) hosts.add(normalized);
    } catch {
      // ignore invalid NEXT_PUBLIC_SITE_URL
    }
  }

  return hosts;
}

const PORTAL_HOSTS = portalHostsFromEnv();

export function isPortalHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return true;
  if (PORTAL_HOSTS.has(normalized)) return true;
  if (normalized.endsWith(".localhost")) return true;
  return false;
}

export function getPortalOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:3000";
}
