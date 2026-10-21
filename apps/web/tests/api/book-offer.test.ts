// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const prismaMock = {
  listing: { findUnique: vi.fn() },
  booking: { count: vi.fn(), create: vi.fn() },
  manualBlock: { count: vi.fn() },
  bookingOffer: { findUnique: vi.fn() },
  hotelAddon: { findMany: vi.fn() },
  bookingAddon: { count: vi.fn(), findMany: vi.fn() },
};
const fetchDynamicPricing = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/airbnb", () => ({
  fetchIcalBlocks: vi.fn(),
  fetchDynamicPricing: (...args: unknown[]) => fetchDynamicPricing(...args),
}));
vi.mock("stripe", () => ({ default: class {} }));

const { POST } = await import("@/app/api/book/route");
const { offerPrice } = await import("@/lib/booking-offers");

const LISTING = {
  id: "fs3",
  hotelId: "h1",
  title: "Forest Studio 3",
  airbnbId: "a1",
  icalUrl: null,
  nightlyBasePrice: 126000,
  baseCurrency: "MXN",
  calendarSources: [],
};
const OFFER = {
  id: "o1",
  token: "tok_12345678",
  listingId: "fs3",
  startDate: new Date("2026-10-27T00:00:00Z"),
  endDate: new Date("2026-10-30T00:00:00Z"),
  nightlyCents: 95000,
  cleaningFeeCents: 15000,
  discountPercent: 10,
  currency: "MXN",
  addonIds: JSON.stringify(["early", "beer"]),
  guestName: "Ana",
  expiresAt: null,
  listing: LISTING,
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/book", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const BODY = {
  listingId: "other",
  start: "2026-11-01",
  end: "2026-11-09",
  email: "guest@example.com",
  phone: "5215551234",
  offerToken: OFFER.token,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
  prismaMock.listing.findUnique.mockResolvedValue(LISTING);
  prismaMock.booking.count.mockResolvedValue(0);
  prismaMock.manualBlock.count.mockResolvedValue(0);
  prismaMock.bookingAddon.count.mockResolvedValue(0);
  prismaMock.bookingAddon.findMany.mockResolvedValue([]);
  prismaMock.booking.create.mockResolvedValue({ id: "b1" });
  prismaMock.bookingOffer.findUnique.mockResolvedValue(OFFER);
});

afterEach(() => {
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
});

describe("booking offers", () => {
  it("prices nights plus cleaning, less the discount", () => {
    expect(offerPrice(OFFER)).toEqual({
      nights: 3,
      staysCents: 285000,
      subtotalCents: 300000,
      discountCents: 30000,
      totalCents: 270000,
    });
  });

  it("books the offer's room, dates and price whatever the client sends", async () => {
    const res = await POST(request(BODY));

    expect(res.status).toBe(200);
    expect(fetchDynamicPricing).not.toHaveBeenCalled();
    expect(prismaMock.listing.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "fs3" } }));
    expect(prismaMock.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listingId: "fs3",
        guestName: "Ana",
        startDate: new Date("2026-10-27"),
        endDate: new Date("2026-10-30"),
        totalPriceCents: 270000,
        currency: "MXN",
      }),
    });
  });

  it("rejects an expired or unknown link", async () => {
    prismaMock.bookingOffer.findUnique.mockResolvedValue({ ...OFFER, expiresAt: new Date("2020-01-01") });

    const res = await POST(request(BODY));

    expect(res.status).toBe(410);
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  it("only accepts the add-ons the owner picked, without the provider-details rule", async () => {
    const outside = await POST(request({ ...BODY, addons: [{ addonId: "wristband", quantity: 1 }] }));
    expect(outside.status).toBe(409);

    prismaMock.hotelAddon.findMany.mockResolvedValue([
      {
        id: "early",
        hotelId: "h1",
        name: "Check-in temprano",
        kind: "early_checkin",
        unit: "item",
        priceCents: 0,
        nightPercent: 20,
        currency: "MXN",
        maxQuantity: 1,
        stock: null,
        options: null,
        depositCents: null,
        providerName: null,
        providerPhone: null,
      },
    ]);
    const res = await POST(request({ ...BODY, addons: [{ addonId: "early", quantity: 1 }] }));

    expect(res.status).toBe(200);
    const where = prismaMock.hotelAddon.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain("providerName");
    expect(prismaMock.booking.create.mock.calls[0][0].data.totalPriceCents).toBe(270000 + 19000);
  });
});
