import { headers } from "next/headers";
import { isPortalHost, normalizeHost } from "@/lib/storefront-host";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** Prefer the current request host on hotel storefront domains. */
export async function getRequestSiteUrl() {
  const headerStore = await headers();
  const host = normalizeHost(
    headerStore.get("x-storefront-host") ?? headerStore.get("host")
  );
  if (host && !isPortalHost(host)) {
    const proto = headerStore.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return getSiteUrl();
}

export function getListingIcalExportUrl(listingId: string) {
  return `${getSiteUrl()}/api/ical/${listingId}/calendar.ics`;
}

export async function getListingIcalExportUrlForRequest(listingId: string) {
  const base = await getRequestSiteUrl();
  return `${base}/api/ical/${listingId}/calendar.ics`;
}
