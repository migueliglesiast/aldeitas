// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  listing: { findMany: vi.fn(), findUnique: vi.fn() },
  booking: { findMany: vi.fn() },
  image: { deleteMany: vi.fn(), create: vi.fn() },
  calendarSource: { upsert: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
};
const fetchIcalBlocks = vi.fn();
const fetchDynamicPricing = vi.fn();
const scrapeListingImages = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/airbnb", () => ({
  fetchIcalBlocks: (...a: unknown[]) => fetchIcalBlocks(...a),
  fetchDynamicPricing: (...a: unknown[]) => fetchDynamicPricing(...a),
  scrapeListingImages: (...a: unknown[]) => scrapeListingImages(...a),
}));

const { GET: listListings } = await import("@/app/api/listings/route");
const { GET: getAvailability } = await import("@/app/api/listings/[id]/availability/route");
const { GET: getPricing } = await import("@/app/api/listings/[id]/pricing/route");
const { GET: getIcal, generateStaticParams } = await import("@/app/api/ical/[listingId]/route");
const { GET: staticAvailability } = await import("@/app/api/availability/route");
const { POST: postImages } = await import("@/app/api/images/route");
const { POST: postCalendar, GET: listCalendars } = await import("@/app/api/calendars/route");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function get(url: string) {
  return new NextRequest(url);
}

function post(body: unknown) {
  return new NextRequest("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/listings", () => {
  it("returns listings ordered by creation date", async () => {
    prismaMock.listing.findMany.mockResolvedValue([{ id: "l1" }]);

    const res = await listListings();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: "l1" }]);
  });

  it("returns a generic 500 on failure", async () => {
    prismaMock.listing.findMany.mockRejectedValue(new Error("db"));

    const res = await listListings();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});

describe("GET /api/listings/[id]/availability", () => {
  const listing = {
    id: "l1",
    title: "Suite",
    icalUrl: null,
    calendarSources: [],
    bookings: [],
  };

  it("returns 404 for an unknown listing", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    const res = await getAvailability(get("http://localhost/api"), { params: { id: "l1" } });

    expect(res.status).toBe(404);
  });

  it("expands local bookings and calendar blocks into booked dates", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ...listing,
      icalUrl: "https://www.airbnb.com/legacy.ics",
      calendarSources: [{ name: "Guesty", icalUrl: "https://api.guesty.com/c.ics" }],
      bookings: [{ startDate: "2025-01-01", endDate: "2025-01-03" }],
    });
    fetchIcalBlocks
      .mockResolvedValueOnce([{ start: "2025-02-01", end: "2025-02-02" }])
      .mockResolvedValueOnce([{ start: "2025-03-01", end: "2025-03-02" }]);

    const res = await getAvailability(get("http://localhost/api"), { params: { id: "l1" } });
    const body = await res.json();

    expect(body.bookedDates).toEqual(["2025-01-01", "2025-01-02", "2025-02-01", "2025-03-01"]);
    expect(body.totalBookedDates).toBe(4);
    expect(body.debug).toBeUndefined();
  });

  it("includes debug output outside production but never in production", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(listing);

    const dev = await getAvailability(get("http://localhost/api?debug=true"), {
      params: { id: "l1" },
    });
    expect((await dev.json()).debug).toMatchObject({ listingId: "l1" });

    const previous = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      const prod = await getAvailability(get("http://localhost/api?debug=true"), {
        params: { id: "l1" },
      });
      expect((await prod.json()).debug).toBeUndefined();
    } finally {
      vi.stubEnv("NODE_ENV", previous ?? "test");
      vi.unstubAllEnvs();
    }
  });

  it("records calendar errors in debug output instead of failing", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ...listing,
      icalUrl: "https://www.airbnb.com/legacy.ics",
      calendarSources: [{ name: "Guesty", icalUrl: "https://api.guesty.com/c.ics" }],
    });
    fetchIcalBlocks.mockRejectedValue(new Error("unreachable"));

    const res = await getAvailability(get("http://localhost/api?debug=true"), {
      params: { id: "l1" },
    });
    const body = await res.json();

    expect(body.bookedDates).toEqual([]);
    expect(body.debug.errors).toHaveLength(2);
    expect(body.debug.fetchedDates.fromCalendarSources[0].error).toBe("unreachable");
  });

  it("returns a generic 500 on failure", async () => {
    prismaMock.listing.findUnique.mockRejectedValue(new Error("db"));

    const res = await getAvailability(get("http://localhost/api"), { params: { id: "l1" } });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});

describe("GET /api/listings/[id]/pricing", () => {
  it("requires both dates", async () => {
    const res = await getPricing(get("http://localhost/api"), { params: { id: "l1" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown listing", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    const res = await getPricing(
      get("http://localhost/api?checkIn=2025-01-01&checkOut=2025-01-03"),
      { params: { id: "l1" } }
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-positive range", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({ nightlyBasePrice: 100, baseCurrency: "USD" });
    fetchDynamicPricing.mockResolvedValue(null);

    const res = await getPricing(
      get("http://localhost/api?checkIn=2025-01-03&checkOut=2025-01-03"),
      { params: { id: "l1" } }
    );

    expect(res.status).toBe(400);
  });

  it("falls back to the base price when dynamic pricing is unavailable", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      airbnbId: "a1",
      nightlyBasePrice: 10000,
      baseCurrency: "USD",
    });
    fetchDynamicPricing.mockResolvedValue(null);

    const res = await getPricing(
      get("http://localhost/api?checkIn=2025-01-01&checkOut=2025-01-03"),
      { params: { id: "l1" } }
    );

    await expect(res.json()).resolves.toEqual({
      nights: 2,
      nightlyCents: 10000,
      totalCents: 20000,
      currency: "USD",
      basePriceCents: 10000,
      baseCurrency: "USD",
      isDynamic: false,
    });
  });

  it("uses dynamic pricing when available", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      airbnbId: "a1",
      nightlyBasePrice: 10000,
      baseCurrency: "USD",
    });
    fetchDynamicPricing.mockResolvedValue({ nightlyCents: 7000, currency: "MXN" });

    const res = await getPricing(
      get("http://localhost/api?checkIn=2025-01-01&checkOut=2025-01-02"),
      { params: { id: "l1" } }
    );

    await expect(res.json()).resolves.toMatchObject({
      totalCents: 7000,
      currency: "MXN",
      isDynamic: true,
    });
  });

  it("returns a generic 500 on failure", async () => {
    prismaMock.listing.findUnique.mockRejectedValue(new Error("db"));

    const res = await getPricing(
      get("http://localhost/api?checkIn=2025-01-01&checkOut=2025-01-03"),
      { params: { id: "l1" } }
    );

    expect(res.status).toBe(500);
  });
});

describe("GET /api/ical/[listingId]", () => {
  it("returns 404 for an unknown listing", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    const res = await getIcal(get("http://localhost/api"), { params: { listingId: "l1" } });

    expect(res.status).toBe(404);
  });

  it("serves a calendar with one event per confirmed booking", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({ id: "l1", title: "Suite" });
    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-03"),
        guestEmail: "guest@example.com",
      },
    ]);

    const res = await getIcal(get("http://localhost/api"), { params: { listingId: "l1" } });
    const body = await res.text();

    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("content-disposition")).toContain("listing-l1.ics");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("Reserved");
  });

  it("pre-generates params for every listing", async () => {
    prismaMock.listing.findMany.mockResolvedValue([{ id: "l1" }, { id: "l2" }]);

    await expect(generateStaticParams()).resolves.toEqual([
      { listingId: "l1" },
      { listingId: "l2" },
    ]);
  });
});

describe("GET /api/availability", () => {
  it("is disabled in the static export", async () => {
    const res = await staticAvailability();
    expect(res.status).toBe(405);
  });
});

describe("POST /api/images", () => {
  it("requires a listingId", async () => {
    const res = await postImages(post({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown listing", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    const res = await postImages(post({ listingId: "l1" }));

    expect(res.status).toBe(404);
  });

  it("replaces the stored images with the scraped ones", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: "l1",
      airbnbUrl: "https://www.airbnb.com/rooms/1",
    });
    scrapeListingImages.mockResolvedValue(["https://a0.muscache.com/1.jpg"]);
    prismaMock.$transaction.mockResolvedValue([]);

    const res = await postImages(post({ listingId: "l1" }));

    await expect(res.json()).resolves.toEqual({ count: 1 });
    expect(prismaMock.image.deleteMany).toHaveBeenCalledWith({ where: { listingId: "l1" } });
    expect(prismaMock.image.create).toHaveBeenCalledWith({
      data: { listingId: "l1", url: "https://a0.muscache.com/1.jpg", position: 0 },
    });
  });

  it("returns a generic 500 when scraping fails", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: "l1",
      airbnbUrl: "https://evil.com/rooms/1",
    });
    scrapeListingImages.mockRejectedValue(new Error("Host is not in the allowlist"));

    const res = await postImages(post({ listingId: "l1" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});

describe("/api/calendars", () => {
  it("rejects an invalid payload", async () => {
    const res = await postCalendar(post({ name: "a", icalUrl: "not-a-url" }));
    expect(res.status).toBe(400);
    expect(prismaMock.calendarSource.upsert).not.toHaveBeenCalled();
  });

  it("rejects a URL outside the allowlist", async () => {
    const res = await postCalendar(
      post({ name: "Internal", icalUrl: "https://169.254.169.254/latest" })
    );

    expect(res.status).toBe(400);
    expect(prismaMock.calendarSource.upsert).not.toHaveBeenCalled();
  });

  it("upserts an allowlisted calendar source", async () => {
    prismaMock.calendarSource.upsert.mockResolvedValue({ id: "c1" });

    const res = await postCalendar(
      post({ name: "Guesty", icalUrl: "https://api.guesty.com/c.ics", listingId: "l1" })
    );

    await expect(res.json()).resolves.toEqual({ id: "c1" });
    expect(prismaMock.calendarSource.upsert).toHaveBeenCalledWith({
      where: { icalUrl: "https://api.guesty.com/c.ics" },
      update: { name: "Guesty", listingId: "l1" },
      create: { name: "Guesty", icalUrl: "https://api.guesty.com/c.ics", listingId: "l1" },
    });
  });

  it("returns a generic 500 when the upsert fails", async () => {
    prismaMock.calendarSource.upsert.mockRejectedValue(new Error("db"));

    const res = await postCalendar(post({ name: "Guesty", icalUrl: "https://api.guesty.com/c.ics" }));

    expect(res.status).toBe(500);
  });

  it("lists calendar sources and hides internal errors", async () => {
    prismaMock.calendarSource.findMany.mockResolvedValueOnce([{ id: "c1" }]);
    await expect((await listCalendars()).json()).resolves.toEqual([{ id: "c1" }]);

    prismaMock.calendarSource.findMany.mockRejectedValueOnce(new Error("db"));
    const failure = await listCalendars();
    expect(failure.status).toBe(500);
    await expect(failure.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
