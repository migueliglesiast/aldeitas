// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = { booking: { findUnique: vi.fn() } };
const createAuth = vi.fn();
const verify = vi.fn();
const finalizeCaptured = vi.fn();
const markAuthorized = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/payment-providers/config", () => ({ isMercadoPagoConfigured: () => true }));
vi.mock("@/lib/payment-providers", () => ({
  createMercadoPagoCardAuthorization: (...args: unknown[]) => createAuth(...args),
}));
vi.mock("@/lib/booking-payment", () => ({
  verifyBookingDatesAvailable: (...args: unknown[]) => verify(...args),
  finalizeCapturedBooking: (...args: unknown[]) => finalizeCaptured(...args),
  markBookingAuthorizedForBooking: (...args: unknown[]) => markAuthorized(...args),
}));

const { POST } = await import("@/app/api/bookings/[id]/pay/route");

function pay(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/bookings/b1/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.booking.findUnique.mockResolvedValue({
    id: "b1",
    status: "PENDING",
    authorizedAt: null,
    totalPriceCents: 270000,
    currency: "MXN",
    guestEmail: "guest@example.com",
  });
});

describe("POST /api/bookings/[id]/pay", () => {
  it("re-checks the dates before charging a debit card, and charges nothing if they're gone", async () => {
    verify.mockResolvedValue({ ok: false, reason: "taken" });

    const res = await pay({ token: "t", payment_method_id: "debvisa" });

    expect(res.status).toBe(409);
    expect(createAuth).not.toHaveBeenCalled();
  });

  it("confirms a debit-card booking right after the charge", async () => {
    verify.mockResolvedValue({ ok: true, snapshot: "[]" });
    createAuth.mockResolvedValue({ orderId: "o2", referenceId: "p2", captured: true });

    const res = await pay({ token: "t", payment_method_id: "debvisa", payment_type_id: "debit_card" });

    expect(res.status).toBe(200);
    expect(createAuth).toHaveBeenCalledWith(expect.objectContaining({ paymentMethodId: "debvisa", paymentTypeId: "debit_card" }));
    expect(finalizeCaptured).toHaveBeenCalledWith("b1", "mercadopago", "o2", "p2", "[]");
    expect(markAuthorized).not.toHaveBeenCalled();
  });

  it("keeps the reserve-then-confirm flow for credit cards", async () => {
    createAuth.mockResolvedValue({ orderId: "o1", referenceId: "p1", captured: false });

    const res = await pay({ token: "t", payment_method_id: "visa" });

    expect(res.status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
    expect(markAuthorized).toHaveBeenCalledWith("b1", "mercadopago", "o1", "p1");
  });

  it("shows the guest a readable message when the card is refused", async () => {
    const { MercadoPagoPaymentError } = await import("@/lib/payment-providers/mercadopago");
    createAuth.mockRejectedValue(new MercadoPagoPaymentError("property_value: Invalid value", "Prueba con otra tarjeta"));

    const res = await pay({ token: "t", payment_method_id: "visa" });

    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toEqual({ error: "Prueba con otra tarjeta" });
  });
});
