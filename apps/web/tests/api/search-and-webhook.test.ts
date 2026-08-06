// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const prismaMock = {
  hotel: { findMany: vi.fn() },
  booking: { update: vi.fn() },
};
const fetchIcalBlocks = vi.fn();
const constructEvent = vi.fn();
const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/airbnb", () => ({ fetchIcalBlocks: (...a: unknown[]) => fetchIcalBlocks(...a) }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: (...a: unknown[]) => constructEvent(...a) };
  },
}));

const { POST: searchAvailability } = await import("@/app/api/search/availability/route");
const { POST: stripeWebhook } = await import("@/app/api/stripe/webhook/route");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.SMTP_HOST;
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

  it("counts only listings with a calendar and no conflicts", async () => {
    prismaMock.hotel.findMany.mockResolvedValue([
      {
        id: "h1",
        listings: [
          { id: "free", icalUrl: null, calendarSources: [{ name: "G", icalUrl: "u" }], bookings: [] },
          { id: "no-calendar", icalUrl: null, calendarSources: [], bookings: [] },
          {
            id: "locally-booked",
            icalUrl: null,
            calendarSources: [{ name: "G", icalUrl: "u" }],
            bookings: [{ id: "b1" }],
          },
        ],
      },
      { id: "h2", listings: [{ id: "x", icalUrl: null, calendarSources: [], bookings: [] }] },
    ]);
    fetchIcalBlocks.mockResolvedValue([]);

    const res = await searchAvailability(post(RANGE));

    await expect(res.json()).resolves.toEqual({ h1: 1 });
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
          },
          {
            id: "unreachable",
            icalUrl: null,
            calendarSources: [{ name: "G", icalUrl: "u" }],
            bookings: [],
          },
        ],
      },
    ]);
    fetchIcalBlocks
      .mockResolvedValueOnce([{ start: new Date("2025-01-02"), end: new Date("2025-01-04") }])
      .mockRejectedValueOnce(new Error("unreachable"));

    const res = await searchAvailability(post(RANGE));

    await expect(res.json()).resolves.toEqual({});
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

describe("POST /api/stripe/webhook", () => {
  it("returns 400 without leaking Stripe details when the signature is invalid", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const res = await stripeWebhook(post({}, { "stripe-signature": "bad" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid webhook signature" });
  });

  it("returns 400 when the webhook secret is not configured", async () => {
    const res = await stripeWebhook(post({}));

    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("ignores unrelated event types", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    constructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });

    const res = await stripeWebhook(post({}, { "stripe-signature": "sig" }));

    await expect(res.json()).resolves.toEqual({ received: true });
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("confirms the booking and emails the guest on checkout completion", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    process.env.SMTP_HOST = "smtp.example.com";
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { metadata: { bookingId: "b1" }, payment_intent: "pi_1" } },
    });
    prismaMock.booking.update.mockResolvedValue({
      guestEmail: "guest@example.com",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-03"),
      totalPriceCents: 20000,
      currency: "USD",
      listing: { title: "Suite" },
    });

    const res = await stripeWebhook(post({}, { "stripe-signature": "sig" }));

    await expect(res.json()).resolves.toEqual({ received: true });
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        data: { status: "CONFIRMED", stripePaymentIntentId: "pi_1" },
      })
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" })
    );
  });

  it("skips the booking update when the event carries no bookingId", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    });

    await stripeWebhook(post({}, { "stripe-signature": "sig" }));

    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });
});
