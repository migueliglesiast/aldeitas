import { isBefore } from "date-fns";
import { fetchIcalBlocks, type AvailabilityBlock } from "@/lib/airbnb";

export type CalendarSourceRef = { name: string; icalUrl: string };

export type ListingCalendars = {
  icalUrl: string | null;
  calendarSources: CalendarSourceRef[];
};

export type SourceFetchResult = CalendarSourceRef &
  ({ ok: true; blocks: AvailabilityBlock[] } | { ok: false; error: string });

export type ExternalBlocksResult = {
  blocks: AvailabilityBlock[];
  sources: SourceFetchResult[];
  /** False when at least one calendar could not be fetched. */
  complete: boolean;
};

export type ExternalAvailability = "available" | "booked" | "unverifiable";

export function listingCalendarSources(listing: ListingCalendars): CalendarSourceRef[] {
  return [
    ...(listing.icalUrl ? [{ name: "legacy", icalUrl: listing.icalUrl }] : []),
    ...listing.calendarSources,
  ];
}

export function hasExternalCalendars(listing: ListingCalendars) {
  return listingCalendarSources(listing).length > 0;
}

/** Fetches every external calendar of a listing in parallel. */
export async function fetchListingExternalBlocks(
  listing: ListingCalendars,
  logPrefix = "[calendars]"
): Promise<ExternalBlocksResult> {
  const sources = await Promise.all(
    listingCalendarSources(listing).map(async (source): Promise<SourceFetchResult> => {
      try {
        return { ...source, ok: true, blocks: await fetchIcalBlocks(source.icalUrl) };
      } catch (error) {
        console.error(`${logPrefix} Failed to fetch calendar ${source.name}:`, error);
        return {
          ...source,
          ok: false,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    })
  );

  return {
    blocks: sources.flatMap((source) => (source.ok ? source.blocks : [])),
    sources,
    complete: sources.every((source) => source.ok),
  };
}

export function blocksOverlapRange(
  blocks: Pick<AvailabilityBlock, "start" | "end">[],
  startDate: Date,
  endDate: Date
) {
  return blocks.some(
    (block) => isBefore(startDate, block.end) && isBefore(block.start, endDate)
  );
}

/**
 * Checks a stay against the listing's external calendars. A calendar that
 * cannot be fetched makes the result "unverifiable" (fail closed).
 */
export async function checkExternalAvailability(
  listing: ListingCalendars,
  startDate: Date,
  endDate: Date,
  logPrefix?: string
): Promise<{ status: ExternalAvailability; result: ExternalBlocksResult }> {
  const result = await fetchListingExternalBlocks(listing, logPrefix);
  if (blocksOverlapRange(result.blocks, startDate, endDate)) {
    return { status: "booked", result };
  }
  return { status: result.complete ? "available" : "unverifiable", result };
}
