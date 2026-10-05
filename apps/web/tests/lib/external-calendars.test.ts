import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchIcalBlocks = vi.fn();
vi.mock("@/lib/airbnb", () => ({ fetchIcalBlocks: (url: string) => fetchIcalBlocks(url) }));

import {
  checkExternalAvailability,
  clearCalendarCache,
  fetchListingExternalBlocks,
} from "@/lib/external-calendars";

const block = { start: new Date("2027-01-10"), end: new Date("2027-01-12") };
const listing = {
  icalUrl: null,
  calendarSources: [{ name: "Airbnb", icalUrl: "https://www.airbnb.es/calendar/ical/1.ics" }],
};

beforeEach(() => {
  clearCalendarCache();
  fetchIcalBlocks.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("external calendar fetching", () => {
  it("shares one download between concurrent callers", async () => {
    fetchIcalBlocks.mockResolvedValue([block]);
    await Promise.all(Array.from({ length: 10 }, () => fetchListingExternalBlocks(listing)));
    expect(fetchIcalBlocks).toHaveBeenCalledTimes(1);
  });

  it("serves browse requests from cache, but verify always downloads", async () => {
    fetchIcalBlocks.mockResolvedValue([block]);
    await fetchListingExternalBlocks(listing);
    await fetchListingExternalBlocks(listing);
    expect(fetchIcalBlocks).toHaveBeenCalledTimes(1);
    await fetchListingExternalBlocks(listing, "[t]", "verify");
    expect(fetchIcalBlocks).toHaveBeenCalledTimes(2);
  });

  it("refreshes the cache after two minutes", async () => {
    fetchIcalBlocks.mockResolvedValue([block]);
    await fetchListingExternalBlocks(listing);
    vi.setSystemTime(new Date("2026-10-05T00:02:01Z"));
    await fetchListingExternalBlocks(listing);
    expect(fetchIcalBlocks).toHaveBeenCalledTimes(2);
  });

  it("retries one fast failure", async () => {
    fetchIcalBlocks.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([block]);
    const result = await fetchListingExternalBlocks(listing, "[t]", "verify");
    expect(result.complete).toBe(true);
    expect(fetchIcalBlocks).toHaveBeenCalledTimes(2);
  });

  it("uses the last good copy for browsing when the feed is down, never for verify", async () => {
    fetchIcalBlocks.mockResolvedValueOnce([block]);
    await fetchListingExternalBlocks(listing);
    vi.setSystemTime(new Date("2026-10-05T00:10:00Z"));
    fetchIcalBlocks.mockRejectedValue(new Error("down"));

    const browse = await fetchListingExternalBlocks(listing);
    expect(browse.complete).toBe(true);
    expect(browse.sources[0]).toMatchObject({ ok: true, stale: true });

    const verify = await checkExternalAvailability(
      listing,
      new Date("2027-02-01"),
      new Date("2027-02-03"),
      "[t]",
      "verify"
    );
    expect(verify.status).toBe("unverifiable");
  });

  it("stops using the last good copy after 30 minutes", async () => {
    fetchIcalBlocks.mockResolvedValueOnce([block]);
    await fetchListingExternalBlocks(listing);
    vi.setSystemTime(new Date("2026-10-05T00:31:00Z"));
    fetchIcalBlocks.mockRejectedValue(new Error("down"));
    const result = await checkExternalAvailability(
      listing,
      new Date("2027-02-01"),
      new Date("2027-02-03")
    );
    expect(result.status).toBe("unverifiable");
  });

  it("reports booked when a fetched block overlaps", async () => {
    fetchIcalBlocks.mockResolvedValue([block]);
    const result = await checkExternalAvailability(
      listing,
      new Date("2027-01-11"),
      new Date("2027-01-13")
    );
    expect(result.status).toBe("booked");
  });
});
