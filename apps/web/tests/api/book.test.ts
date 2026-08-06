// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const prismaMock = {
  listing: { findUnique: vi.fn() },
  booking: { count: vi.fn(), create: vi.fn() },
};
const fetchIcalBlocks = vi.fn();
const fetchDynamicPricing = vi.fn();
const sessionsCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/airbnb", () => ({
  fetchIcalBlocks: (...args: unknown[]) => fetchIcalBlocks(...args),
  fetchDynamicPricing: (...args: unknown[]) => fetchDynamicPricing(...args),
}));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: (...args: unknown[]) => sessionsCreate(...args) } };
  },
}));

const { POST } = await import("@/app/api/book/route");

const VALID_BODY = {
  listingId: "l1",
  start: "2025-01-01",
  end: "2025-01-03",
  email: "guest@example.com",
  phone: "5215551234",
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/book", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LISTING = {
  id: "l1",
  title: "Suite 1",
  airbnbId: "a1",
  icalUrl: null,
  nightlyBasePrice: 10000,
  baseCurrency: "USD",
  calendarSources: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.STRIPE_SECRET_KEY;
  fetchDynamicPricing.mockResolvedValue(null);
  prismaMock.booking.count.mockResolvedValue(0);
  prismaMock.booking.create.mockResolvedValue({ id: "b1" });
});

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
});

describe("POST /api/book", () => {
  it("rejects an invalid payload with 400", async () => {
    const res = await POST(request({ listingId: "l1" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid payload" });
  });

  it("returns 404 for an unknown listing", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(404);
  });

  it("returns 409 when an external calendar blocks the dates", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ...LISTING,
      calendarSources: [{ name: "Airbnb", icalUrl: "https://www.airbnb.com/c.ics" }],
    });
    fetchIcalBlocks.mockResolvedValue([
      { start: new Date("2025-01-02"), end: new Date("2025-01-04") },
    ]);

    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Dates unavailable" });
  });

  it("returns 409 when a local booking overlaps", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(LISTING);
    prismaMock.booking.count.mockResolvedValue(1);

    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(409);
  });

  it("returns 400 for a non-positive date range", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(LISTING);

    const res = await POST(request({ ...VALID_BODY, end: "2025-01-01" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid date range" });
  });

  it("creates a PENDING booking when payment is not configured", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(LISTING);

    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      bookingId: "b1",
      message: "Booking created (payment not configured)",
    });
    expect(prismaMock.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listingId: "l1",
        status: "PENDING",
        totalPriceCents: 20000,
        currency: "USD",
      }),
    });
  });

  it("uses dynamic pricing and returns a Stripe checkout url", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    prismaMock.listing.findUnique.mockResolvedValue(LISTING);
    fetchDynamicPricing.mockResolvedValue({ nightlyCents: 5000, currency: "MXN" });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s/1" });

    const res = await POST(request(VALID_BODY));

    await expect(res.json()).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.com/s/1",
    });
    expect(prismaMock.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalPriceCents: 10000, currency: "MXN" }),
    });
  });

  it("fails closed with 503 when a calendar cannot be fetched", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ...LISTING,
      icalUrl: "https://www.airbnb.com/legacy.ics",
      calendarSources: [{ name: "Broken", icalUrl: "https://www.airbnb.com/c.ics" }],
    });
    fetchIcalBlocks.mockRejectedValue(new Error("unreachable"));

    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Availability cannot be verified" });
  });

  it("returns a generic 500 when something unexpected fails", async () => {
    prismaMock.listing.findUnique.mockRejectedValue(new Error("db exploded"));

    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("is disabled during static export", async () => {
    process.env.NEXT_PHASE = "phase-export";
    try {
      const res = await POST(request(VALID_BODY));
      expect(res.status).toBe(405);
    } finally {
      delete process.env.NEXT_PHASE;
    }
  });
});
