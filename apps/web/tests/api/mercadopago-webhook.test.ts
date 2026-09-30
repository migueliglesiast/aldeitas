// @vitest-environment node
import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const markBookingAuthorizedFromPaymentOrder = vi.fn();
const getMercadoPagoOrder = vi.fn();

vi.mock("@/lib/booking-payment", () => ({
  markBookingAuthorizedFromPaymentOrder: (...args: unknown[]) =>
    markBookingAuthorizedFromPaymentOrder(...args),
}));
vi.mock("@/lib/payment-providers/mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment-providers/mercadopago")>();
  return {
    ...actual,
    getMercadoPagoOrder: (...args: unknown[]) => getMercadoPagoOrder(...args),
  };
});

const { POST } = await import("@/app/api/mercadopago/webhook/route");

const ORDER_ID = "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3";
const BODY = { action: "order.action_required", type: "order", data: { id: ORDER_ID } };
const AUTHORIZED_ORDER = {
  id: ORDER_ID,
  status: "action_required",
  status_detail: "waiting_capture",
  external_reference: "b1",
};

function sign(secret: string, dataId: string, requestId: string, ts: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

function request(headers: Record<string, string> = {}, body: unknown = BODY) {
  return new NextRequest(
    `http://localhost/api/mercadopago/webhook?data.id=${ORDER_ID}&type=order`,
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  getMercadoPagoOrder.mockResolvedValue(AUTHORIZED_ORDER);
});

afterEach(() => {
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
});

describe("POST /api/mercadopago/webhook", () => {
  it("returns 400 when Mercado Pago is not configured", async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;

    const res = await POST(request());

    expect(res.status).toBe(400);
  });

  it("fetches the order and authorizes its booking", async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(getMercadoPagoOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(markBookingAuthorizedFromPaymentOrder).toHaveBeenCalledWith(
      "mercadopago",
      ORDER_ID,
      "b1"
    );
  });

  it("ignores orders that are not awaiting capture", async () => {
    getMercadoPagoOrder.mockResolvedValue({ ...AUTHORIZED_ORDER, status: "processed", status_detail: "accredited" });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(markBookingAuthorizedFromPaymentOrder).not.toHaveBeenCalled();
  });

  it("ignores non-order topics", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/mercadopago/webhook?data.id=1&type=payment", {
        method: "POST",
        body: JSON.stringify({ type: "payment", data: { id: "1" } }),
      })
    );

    expect(res.status).toBe(200);
    expect(getMercadoPagoOrder).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed notification when a secret is configured", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "whsec";
    const ts = "1742505638683";
    const requestId = "2066ca19-c6f1-498a-be75-1923005edd06";

    const res = await POST(
      request({
        "x-request-id": requestId,
        "x-signature": `ts=${ts},v1=${sign("whsec", ORDER_ID, requestId, ts)}`,
      })
    );

    expect(res.status).toBe(200);
    expect(markBookingAuthorizedFromPaymentOrder).toHaveBeenCalled();
  });

  it("rejects an unsigned or wrongly signed notification when a secret is configured", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "whsec";

    const unsigned = await POST(request());
    const forged = await POST(
      request({
        "x-request-id": "r1",
        "x-signature": `ts=1,v1=${sign("other", ORDER_ID, "r1", "1")}`,
      })
    );

    expect(unsigned.status).toBe(401);
    expect(forged.status).toBe(401);
    expect(getMercadoPagoOrder).not.toHaveBeenCalled();
  });

  it("still acknowledges the notification when processing fails", async () => {
    getMercadoPagoOrder.mockRejectedValue(new Error("mp down"));

    const res = await POST(request());

    expect(res.status).toBe(200);
  });
});
