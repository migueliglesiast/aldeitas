export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function getListingIcalExportUrl(listingId: string) {
  return `${getSiteUrl()}/api/ical/${listingId}/calendar.ics`;
}
