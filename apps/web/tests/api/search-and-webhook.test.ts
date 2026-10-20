// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  hotel: { findMany: vi.fn() },
};
const fetchIcalBlocks = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/airbnb", () => ({ fetchIcalBlocks: (...a: unknown[]) => fetchIcalBlocks(...a) }));

const { POST: searchAvailability } = await import("@/app/api/search/availability/route");
const { clearCalendarCache } = await import("@/lib/external-calendars");

beforeEach(() => {
  vi.clearAllMocks();
  clearCalendarCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const RANGE = { checkIn: "2025-01-01", checkOut: "2025-01-03" };

describe("POST /api/search/availability", () => {
  it("requires both dates", async () => {
    const res = await searchAvailability(post({ checkIn: "2025-01-01" }));
    expect(res.status).toBe(400);
  });

  it("returns listings without conflicts, including those without a calendar", async () => {
    prismaMock.hotel.findMany.mockResolvedValue([
      {
        id: "h1",
        listings: [
          { id: "free", icalUrl: null, calendarSources: [{ name: "G", icalUrl: "u" }], bookings: [], manualBlocks: [] },
          { id: "no-calendar", icalUrl: null, calendarSources: [], bookings: [], manualBlocks: [] },
          {
            id: "locally-booked",
            icalUrl: null,
            calendarSources: [{ name: "G", icalUrl: "u" }],
            bookings: [{ id: "b1" }],
            manualBlocks: [],
          },
        ],
      },
      { id: "h2", listings: [{ id: "x", icalUrl: null, calendarSources: [], bookings: [], manualBlocks: [] }] },
    ]);
    fetchIcalBlocks.mockResolvedValue([]);

    const res = await searchAvailability(post(RANGE));

    await expect(res.json()).resolves.toEqual({
      listingIds: ["free", "no-calendar", "x"],
    });
  });

  it("treats blocked and unreachable calendars as unavailable", async () => {
    prismaMock.hotel.findMany.mockResolvedValue([
      {
        id: "h1",
        listings: [
          {
            id: "blocked",
            icalUrl: "https://www.airbnb.com/legacy.ics",
            calendarSources: [],
            bookings: [],
            manualBlocks: [],
          },
          {
            id: "unreachable",
            icalUrl: null,
            calendarSources: [{ name: "G", icalUrl: "u" }],
            bookings: [],
            manualBlocks: [],
          },
        ],
      },
    ]);
    fetchIcalBlocks
      .mockResolvedValueOnce([{ start: new Date("2025-01-02"), end: new Date("2025-01-04") }])
      .mockRejectedValue(new Error("unreachable"));

    const res = await searchAvailability(post(RANGE));

    await expect(res.json()).resolves.toEqual({ listingIds: [] });
  });

  it("treats listings with an overlapping host manual block as unavailable", async () => {
    prismaMock.hotel.findMany.mockResolvedValue([
      {
        id: "h1",
        listings: [
          { id: "free", icalUrl: null, calendarSources: [], bookings: [], manualBlocks: [] },
          {
            id: "host-blocked",
            icalUrl: null,
            calendarSources: [],
            bookings: [],
            manualBlocks: [{ id: "m1" }],
          },
        ],
      },
    ]);

    const res = await searchAvailability(post(RANGE));

    await expect(res.json()).resolves.toEqual({ listingIds: ["free"] });
  });

  it("returns a generic 500 on malformed input or failures", async () => {
    const malformed = await searchAvailability(post("not json"));
    expect(malformed.status).toBe(500);
    await expect(malformed.json()).resolves.toEqual({ error: "Internal server error" });

    prismaMock.hotel.findMany.mockRejectedValue(new Error("db"));
    const failure = await searchAvailability(post(RANGE));
    expect(failure.status).toBe(500);
  });
});
