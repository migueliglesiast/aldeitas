// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMercadoPagoAuthorizedOrder,
  guestPaymentErrorMessage,
  MercadoPagoPaymentError,
  resolveCardPaymentMethod,
} from "@/lib/payment-providers/mercadopago";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-test";
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY = "APP_USR-public";
  process.env.MERCADOPAGO_SANDBOX = "false";
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  delete process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
  delete process.env.MERCADOPAGO_SANDBOX;
});

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const PARAMS = {
  bookingId: "b1",
  amountCents: 270000,
  currency: "MXN",
  payerEmail: "guest@example.com",
  cardToken: "tok",
  installments: 1,
};

describe("resolveCardPaymentMethod", () => {
  it("only reserves Visa, Mastercard and Amex credit cards", () => {
    expect(resolveCardPaymentMethod("visa")).toEqual({ id: "visa", type: "credit_card", manualCapture: true });
    expect(resolveCardPaymentMethod("mastercard")).toEqual({ id: "master", type: "credit_card", manualCapture: true });
    expect(resolveCardPaymentMethod("debvisa")).toEqual({ id: "debvisa", type: "debit_card", manualCapture: false });
    expect(resolveCardPaymentMethod("debmaster")).toMatchObject({ type: "debit_card", manualCapture: false });
    expect(resolveCardPaymentMethod("visa", "prepaid_card")).toMatchObject({ type: "prepaid_card", manualCapture: false });
    expect(resolveCardPaymentMethod("visa", "bogus")).toMatchObject({ type: "credit_card", manualCapture: true });
  });
});

describe("guestPaymentErrorMessage", () => {
  it("never shows raw Mercado Pago codes", () => {
    expect(guestPaymentErrorMessage("property_value: Invalid value for property")).not.toContain("property_value");
    expect(guestPaymentErrorMessage("pay_1: cc_rejected_insufficient_amount")).toContain("Fondos insuficientes");
    expect(guestPaymentErrorMessage("required_call_for_authorize")).toContain("banco");
  });
});

describe("createMercadoPagoAuthorizedOrder", () => {
  it("reserves a credit card with manual capture", async () => {
    fetchMock.mockReturnValue(
      reply(201, { id: "o1", status: "action_required", status_detail: "waiting_capture", transactions: { payments: [{ id: "p1" }] } })
    );

    const result = await createMercadoPagoAuthorizedOrder({ ...PARAMS, paymentMethodId: "visa" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.capture_mode).toBe("manual");
    expect(body.transactions.payments[0].payment_method).toMatchObject({ id: "visa", type: "credit_card" });
    expect(result).toEqual({ orderId: "o1", referenceId: "p1", captured: false });
  });

  it("charges a debit card at once instead of sending it as a credit card", async () => {
    fetchMock.mockReturnValue(
      reply(201, { id: "o2", status: "processed", status_detail: "accredited", transactions: { payments: [{ id: "p2", status: "processed" }] } })
    );

    const result = await createMercadoPagoAuthorizedOrder({ ...PARAMS, paymentMethodId: "debvisa" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.capture_mode).toBe("automatic");
    expect(body.transactions.payments[0].payment_method).toMatchObject({ id: "debvisa", type: "debit_card" });
    expect(result.captured).toBe(true);
  });

  it("sends the device fingerprint, stay details and 3DS-on-risk to Mercado Pago", async () => {
    fetchMock.mockReturnValue(
      reply(201, { id: "o3", status: "processed", status_detail: "accredited", transactions: { payments: [{ id: "p3", status: "processed" }] } })
    );

    await createMercadoPagoAuthorizedOrder({
      ...PARAMS,
      paymentMethodId: "debmaster",
      deviceId: "dev-123",
      payerName: "David Cullinane",
      item: { title: "Forest Studio 3 · La Arbolita", description: "Estancia", pictureUrl: "https://x/p.jpg" },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(init.headers["X-meli-session-id"]).toBe("dev-123");
    expect(body.payer).toEqual({ email: "guest@example.com", first_name: "David", last_name: "Cullinane" });
    expect(body.items[0]).toMatchObject({ title: "Forest Studio 3 · La Arbolita", quantity: 1, unit_price: "2700.00", picture_url: "https://x/p.jpg" });
    expect(body.config.online.transaction_security).toEqual({ validation: "on_fraud_risk", liability_shift: "required" });
  });

  it("returns the bank verification page instead of failing when Mercado Pago asks for 3DS", async () => {
    fetchMock.mockReturnValue(
      reply(201, {
        id: "o4",
        status: "action_required",
        status_detail: "pending_challenge",
        transactions: {
          payments: [
            {
              id: "p4",
              status: "action_required",
              status_detail: "pending_challenge",
              payment_method: { transaction_security: { url: "https://mp/challenge" } },
            },
          ],
        },
      })
    );

    const result = await createMercadoPagoAuthorizedOrder({ ...PARAMS, paymentMethodId: "debvisa" });

    expect(result).toEqual({ orderId: "o4", referenceId: "p4", captured: false, challengeUrl: "https://mp/challenge" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a fraud-check decline instead of a generic card error", () => {
    const message = guestPaymentErrorMessage("PAY01: high_risk");
    expect(message).toContain("antifraude");
    expect(message).toContain("nothing was charged");
  });

  it("turns an API rejection into a guest-friendly error", async () => {
    fetchMock.mockReturnValue(
      reply(400, {
        errors: [
          {
            code: "property_value",
            message: "Invalid value for property",
            details: ["'$.transactions.payments[0].payment_method.id' - value must be one of 'amex', 'master', 'visa'"],
          },
        ],
      })
    );

    const error = await createMercadoPagoAuthorizedOrder({ ...PARAMS, paymentMethodId: "visa" }).catch((e) => e);

    expect(error).toBeInstanceOf(MercadoPagoPaymentError);
    expect(error.message).toContain("value must be one of");
    expect(error.guestMessage).not.toContain("property_value");
  });
});
