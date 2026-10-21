// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = { booking: { findUnique: vi.fn(), update: vi.fn() } };
const checkExternal = vi.fn();
const cachedExternal = vi.fn();
const cancelBooking = vi.fn();
const reconcileBooking = vi.fn();
const recordEvent = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/booking-email", () => ({ sendBookingProcessingEmail: vi.fn() }));
vi.mock("@/lib/booking-events", () => ({ recordBookingEvent: (...a: unknown[]) => recordEvent(...a) }));
vi.mock("@/lib/booking-blocks", () => ({
  hasLocalDateConflict: vi.fn().mockResolvedValue(false),
  cancelUnpaidPendingBooking: vi.fn(),
}));
vi.mock("@/lib/booking-reconcile", () => ({
  cancelBooking: (...a: unknown[]) => cancelBooking(...a),
  confirmBooking: vi.fn(),
  reconcileBooking: (...a: unknown[]) => reconcileBooking(...a),
  serializeBlocks: (blocks: unknown[]) => blocks,
}));
vi.mock("@/lib/external-calendars", () => ({
  checkExternalAvailability: (...a: unknown[]) => checkExternal(...a),
  cachedExternalAvailability: (...a: unknown[]) => cachedExternal(...a),
}));
vi.mock("@/lib/payment-providers", () => ({
  getProviderAuthorizationState: vi.fn().mockResolvedValue({ authorized: true }),
}));

const { markBookingAuthorizedForBooking } = await import("@/lib/booking-payment");

const unverifiable = { status: "unverifiable", result: { blocks: [], sources: [], complete: false } };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.booking.findUnique.mockResolvedValue({
    id: "b1",
    status: "PENDING",
    authorizedAt: null,
    listingId: "l1",
    startDate: new Date("2026-10-27"),
    endDate: new Date("2026-10-30"),
    listing: { icalUrl: null, calendarSources: [{ name: "Airbnb", icalUrl: "https://a/1.ics" }] },
  });
  prismaMock.booking.update.mockImplementation(async ({ data }) => ({ id: "b1", ...data }));
});

describe("card hold while the booking sites can't be reached", () => {
  it("keeps the hold (no charge) when a recent copy shows the dates free", async () => {
    checkExternal.mockResolvedValue(unverifiable);
    cachedExternal.mockReturnValue({
      status: "available",
      result: { blocks: [], sources: [], complete: true },
      oldestFetchedAt: new Date(Date.now() - 10 * 60000),
    });

    await markBookingAuthorizedForBooking("b1", "mercadopago", "o1", "p1");

    expect(cancelBooking).not.toHaveBeenCalled();
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorizedAt: expect.any(Date) }) })
    );
    expect(recordEvent).toHaveBeenCalledWith("b1", "availability_check", "wait", expect.stringContaining("10 min ago"));
    expect(reconcileBooking).toHaveBeenCalledWith("b1");
  });

  it("releases the hold when there is no recent copy either", async () => {
    checkExternal.mockResolvedValue(unverifiable);
    cachedExternal.mockReturnValue({ ...unverifiable, oldestFetchedAt: null });

    await markBookingAuthorizedForBooking("b1", "mercadopago", "o1", "p1");

    expect(cancelBooking).toHaveBeenCalledTimes(1);
  });

  it("releases the hold when the recent copy shows the dates taken", async () => {
    checkExternal.mockResolvedValue(unverifiable);
    cachedExternal.mockReturnValue({
      status: "booked",
      result: { blocks: [], sources: [], complete: true },
      oldestFetchedAt: new Date(),
    });

    await markBookingAuthorizedForBooking("b1", "mercadopago", "o1", "p1");

    expect(cancelBooking).toHaveBeenCalledTimes(1);
  });
});
