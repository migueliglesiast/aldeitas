import { isPortalHost, normalizeHost } from "./storefront-host";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aldeitas.io").replace(/\/$/, "");

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "reservas@aldeitas.io";

export function siteOriginForHost(host: string | null | undefined): string {
  if (isPortalHost(host)) return SITE_URL;
  return `https://${normalizeHost(host)}`;
}
