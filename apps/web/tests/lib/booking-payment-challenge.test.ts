// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = { booking: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } };
const getOrder = vi.fn();
const confirmBooking = vi.fn();
const recordEvent = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/booking-email", () => ({ sendBookingProcessingEmail: vi.fn() }));
vi.mock("@/lib/booking-events", () => ({ recordBookingEvent: (...a: unknown[]) => recordEvent(...a) }));
vi.mock("@/lib/booking-blocks", () => ({
  hasLocalDateConflict: vi.fn().mockResolvedValue(false),
  cancelUnpaidPendingBooking: vi.fn(),
}));
vi.mock("@/lib/booking-reconcile", () => ({
  cancelBooking: vi.fn(),
  confirmBooking: (...a: unknown[]) => confirmBooking(...a),
  reconcileBooking: vi.fn(),
  serializeBlocks: (blocks: unknown[]) => blocks,
}));
vi.mock("@/lib/external-calendars", () => ({
  checkExternalAvailability: vi.fn(),
  cachedExternalAvailability: vi.fn(),
}));
vi.mock("@/lib/payment-providers", () => ({
  getProviderAuthorizationState: vi.fn().mockResolvedValue({ authorized: true }),
}));
vi.mock("@/lib/payment-providers/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payment-providers/mercadopago")>()),
  getMercadoPagoOrder: (...a: unknown[]) => getOrder(...a),
}));

const { settleMercadoPagoChallenge } = await import("@/lib/booking-payment");

const pendingBooking = {
  id: "b1",
  status: "PENDING",
  authorizedAt: null,
  paymentProvider: "mercadopago",
  paymentOrderId: "o1",
  externalBlocksSnapshot: "[snap]",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.booking.findUnique.mockResolvedValue(pendingBooking);
  prismaMock.booking.update.mockResolvedValue({ ...pendingBooking, listing: {} });
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
});

describe("settleMercadoPagoChallenge", () => {
  it("keeps waiting while the guest is still on the bank's verification page", async () => {
    getOrder.mockResolvedValue({
      id: "o1",
      status: "action_required",
      status_detail: "pending_challenge",
      transactions: { payments: [{ id: "p1", payment_method: { transaction_security: { url: "https://mp/c" } } }] },
    });

    await expect(settleMercadoPagoChallenge("b1")).resolves.toEqual({ state: "pending", challengeUrl: "https://mp/c" });
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it("confirms the booking once the verified debit charge goes through, using the pre-charge calendar check", async () => {
    getOrder.mockResolvedValue({ id: "o1", status: "processed", status_detail: "accredited", transactions: { payments: [{ id: "p1", status: "processed" }] } });

    await expect(settleMercadoPagoChallenge("b1")).resolves.toEqual({ state: "done" });
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentOrderId: "o1", externalBlocksSnapshot: "[snap]" }) })
    );
    expect(confirmBooking).toHaveBeenCalledTimes(1);
  });

  it("confirms only once when the pay page and the webhook settle at the same time", async () => {
    getOrder.mockResolvedValue({ id: "o1", status: "processed", transactions: { payments: [{ id: "p1", status: "processed" }] } });
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(settleMercadoPagoChallenge("b1")).resolves.toEqual({ state: "done" });
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it("frees the booking for another card when the bank verification fails", async () => {
    getOrder.mockResolvedValue({
      id: "o1",
      status: "failed",
      transactions: { payments: [{ id: "p1", status: "failed", status_detail: "cc_rejected_3ds_challenge" }] },
    });

    const result = await settleMercadoPagoChallenge("b1");

    expect(result.state).toBe("failed");
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", paymentOrderId: "o1", authorizedAt: null },
      data: { paymentOrderId: null, paymentReference: null },
    });
    expect(recordEvent).toHaveBeenCalledWith("b1", "payment_failed", "fail", expect.stringContaining("verificar"));
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it("does nothing for a booking that isn't waiting on a verification", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({ ...pendingBooking, paymentOrderId: null });

    await expect(settleMercadoPagoChallenge("b1")).resolves.toEqual({ state: "none" });
    expect(getOrder).not.toHaveBeenCalled();
  });
});
