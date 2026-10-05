import { isBefore } from "date-fns";
import { fetchIcalBlocks, type AvailabilityBlock } from "@/lib/airbnb";

export type CalendarSourceRef = { name: string; icalUrl: string };

export type ListingCalendars = {
  icalUrl: string | null;
  calendarSources: CalendarSourceRef[];
};

export type SourceFetchResult = CalendarSourceRef &
  (
    | { ok: true; blocks: AvailabilityBlock[]; fetchedAt: Date; stale: boolean }
    | { ok: false; error: string }
  );

export type ExternalBlocksResult = {
  blocks: AvailabilityBlock[];
  sources: SourceFetchResult[];
  /** False when at least one calendar could not be fetched. */
  complete: boolean;
};

export type ExternalAvailability = "available" | "booked" | "unverifiable";

/**
 * - "browse": search, room calendar and Reserve. Serves a recent copy when
 *   possible and falls back to the last good copy if the feed is down.
 * - "verify": payment authorization and confirmation. Always downloads the
 *   feed; never trusts an old copy.
 */
export type CalendarFetchMode = "browse" | "verify";

function envMs(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const CACHE_TTL_MS = envMs("ICAL_CACHE_TTL_MS", 2 * 60 * 1000);
const STALE_IF_ERROR_MS = envMs("ICAL_STALE_IF_ERROR_MS", 30 * 60 * 1000);
const MAX_CONCURRENT_FETCHES = Math.max(1, envMs("ICAL_MAX_CONCURRENT_FETCHES", 6));
const RETRY_DELAY_MS = envMs("ICAL_RETRY_DELAY_MS", 500);
const FAST_FAILURE_MS = envMs("ICAL_FAST_FAILURE_MS", 3000);

type CacheEntry = { blocks: AvailabilityBlock[]; fetchedAt: number };

const lastGood = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

let activeFetches = 0;
const waiting: Array<() => void> = [];

async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeFetches >= MAX_CONCURRENT_FETCHES) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeFetches += 1;
  try {
    return await task();
  } finally {
    activeFetches -= 1;
    waiting.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadWithRetry(icalUrl: string): Promise<CacheEntry> {
  const startedAt = Date.now();
  try {
    return { blocks: await fetchIcalBlocks(icalUrl), fetchedAt: Date.now() };
  } catch (error) {
    // Timeouts are not retried: the caller has already waited long enough.
    if (Date.now() - startedAt > FAST_FAILURE_MS) throw error;
    await sleep(RETRY_DELAY_MS);
    return { blocks: await fetchIcalBlocks(icalUrl), fetchedAt: Date.now() };
  }
}

/** Downloads a feed, sharing one request between concurrent callers. */
function downloadShared(icalUrl: string): Promise<CacheEntry> {
  const pending = inFlight.get(icalUrl);
  if (pending) return pending;

  const request = withFetchSlot(() => downloadWithRetry(icalUrl))
    .then((entry) => {
      lastGood.set(icalUrl, entry);
      return entry;
    })
    .finally(() => inFlight.delete(icalUrl));
  inFlight.set(icalUrl, request);
  return request;
}

async function fetchSource(
  source: CalendarSourceRef,
  mode: CalendarFetchMode,
  logPrefix: string
): Promise<SourceFetchResult> {
  const cached = lastGood.get(source.icalUrl);
  const cachedAge = cached ? Date.now() - cached.fetchedAt : Infinity;

  if (mode === "browse" && cached && cachedAge <= CACHE_TTL_MS) {
    return { ...source, ok: true, blocks: cached.blocks, fetchedAt: new Date(cached.fetchedAt), stale: false };
  }

  try {
    const entry = await downloadShared(source.icalUrl);
    return { ...source, ok: true, blocks: entry.blocks, fetchedAt: new Date(entry.fetchedAt), stale: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (mode === "browse" && cached && cachedAge <= STALE_IF_ERROR_MS) {
      console.warn(
        `${logPrefix} Calendar ${source.name} unreachable (${message}); using copy from ${Math.round(cachedAge / 1000)}s ago`
      );
      return { ...source, ok: true, blocks: cached.blocks, fetchedAt: new Date(cached.fetchedAt), stale: true };
    }
    console.error(`${logPrefix} Failed to fetch calendar ${source.name}:`, error);
    return { ...source, ok: false, error: message };
  }
}

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
  logPrefix = "[calendars]",
  mode: CalendarFetchMode = "browse"
): Promise<ExternalBlocksResult> {
  const sources = await Promise.all(
    listingCalendarSources(listing).map((source) => fetchSource(source, mode, logPrefix))
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
  logPrefix?: string,
  mode: CalendarFetchMode = "browse"
): Promise<{ status: ExternalAvailability; result: ExternalBlocksResult }> {
  const result = await fetchListingExternalBlocks(listing, logPrefix, mode);
  if (blocksOverlapRange(result.blocks, startDate, endDate)) {
    return { status: "booked", result };
  }
  return { status: result.complete ? "available" : "unverifiable", result };
}

/** Test helper: forget cached calendars. */
export function clearCalendarCache() {
  lastGood.clear();
  inFlight.clear();
}
