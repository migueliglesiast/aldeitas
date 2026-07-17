/** Extract numeric Airbnb listing ID from common URL / iCal shapes. */
export function extractAirbnbListingId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (/^\d{5,}$/.test(trimmed)) return trimmed;

    const fromRooms = trimmed.match(/\/rooms\/(\d{5,})/i);
    if (fromRooms?.[1]) return fromRooms[1];

    const fromIcal = trimmed.match(/\/calendar\/ical\/(\d{5,})/i);
    if (fromIcal?.[1]) return fromIcal[1];

    const fromHost = trimmed.match(/[?&](?:listing_id|room_id)=(\d{5,})/i);
    if (fromHost?.[1]) return fromHost[1];
  }

  return null;
}

export function resolveListingAirbnbId(listing: {
  airbnbId?: string | null;
  airbnbUrl?: string | null;
  icalUrl?: string | null;
  calendarSources?: Array<{ icalUrl: string }>;
}): string | null {
  return extractAirbnbListingId(
    listing.airbnbId,
    listing.airbnbUrl,
    listing.icalUrl,
    ...(listing.calendarSources?.map((source) => source.icalUrl) ?? [])
  );
}
