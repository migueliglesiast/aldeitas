import { randomUUID } from "crypto";
import type { AuthorizedPaymentState } from "@/lib/payment-providers/types";
import { isMercadoPagoConfigured } from "@/lib/payment-providers/config";

const MERCADOPAGO_API = "https://api.mercadopago.com";

export function isMercadoPagoSandbox() {
  if (process.env.MERCADOPAGO_SANDBOX === "false") return false;
  if (process.env.MERCADOPAGO_SANDBOX === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function resolveMercadoPagoPayerEmail(guestEmail: string) {
  if (!isMercadoPagoSandbox()) return guestEmail;
  if (guestEmail.toLowerCase().includes("@testuser.com")) return guestEmail;
  return process.env.MERCADOPAGO_TEST_PAYER_EMAIL || "test@testuser.com";
}

export function resolveMercadoPagoCharge(amountCents: number, _currency: string) {
  return { amountCents, currency: "MXN" };
}

function formatMercadoPagoApiError(payload: Record<string, unknown>, status: number) {
  const errors = payload?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const details = errors
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const item = entry as { code?: string; message?: string };
        return [item.code, item.message].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join("; ");
    if (details) return details;
  }

  const message = payload?.message || payload?.error;
  if (typeof message === "string" && message.trim()) return message;

  return `Mercado Pago request failed (${status})`;
}

type MercadoPagoOrder = {
  id: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      status_detail?: string;
    }>;
  };
};

function formatAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

async function mercadoPagoRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Mercado Pago is not configured");
  }

  const response = await fetch(`${MERCADOPAGO_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": randomUUID(),
      ...(options.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const message = formatMercadoPagoApiError(payload, response.status);
    console.error("[mercadopago] API error:", response.status, payload);
    throw new Error(message);
  }

  return payload as T;
}

function getPrimaryPayment(order: MercadoPagoOrder) {
  return order.transactions?.payments?.[0];
}

export function isMercadoPagoOrderAuthorized(order: MercadoPagoOrder) {
  const payment = getPrimaryPayment(order);
  if (
    order.status === "action_required" &&
    order.status_detail === "waiting_capture"
  ) {
    return true;
  }

  return (
    payment?.status === "action_required" &&
    payment?.status_detail === "waiting_capture"
  );
}

export async function createMercadoPagoAuthorizedOrder(params: {
  bookingId: string;
  amountCents: number;
  currency: string;
  payerEmail: string;
  cardToken: string;
  paymentMethodId: string;
  installments?: number;
}) {
  if (!isMercadoPagoConfigured()) {
    throw new Error("Mercado Pago is not configured");
  }

  const charge = resolveMercadoPagoCharge(params.amountCents, params.currency);
  const payerEmail = resolveMercadoPagoPayerEmail(params.payerEmail);
  const amount = formatAmount(charge.amountCents);

  const order = await mercadoPagoRequest<MercadoPagoOrder>("/v1/orders", {
    method: "POST",
    body: JSON.stringify({
      capture_mode: "manual",
      type: "online",
      external_reference: params.bookingId,
      processing_mode: "automatic",
      marketplace: "NONE",
      total_amount: amount,
      currency: charge.currency,
      payer: {
        email: payerEmail,
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: params.paymentMethodId,
              type: "credit_card",
              token: params.cardToken,
              installments: params.installments || 1,
            },
          },
        ],
      },
    }),
  });

  if (!isMercadoPagoOrderAuthorized(order)) {
    throw new Error("Mercado Pago did not authorize the payment");
  }

  const payment = getPrimaryPayment(order);
  return {
    orderId: order.id,
    referenceId: payment?.id,
  };
}

export async function getMercadoPagoOrder(orderId: string) {
  return mercadoPagoRequest<MercadoPagoOrder>(`/v1/orders/${orderId}`);
}

export async function getMercadoPagoAuthorizationState(
  orderId: string
): Promise<AuthorizedPaymentState> {
  const order = await getMercadoPagoOrder(orderId);
  const payment = getPrimaryPayment(order);

  return {
    authorized: isMercadoPagoOrderAuthorized(order),
    orderId: order.id,
    referenceId: payment?.id,
  };
}

export async function captureMercadoPagoOrder(orderId: string) {
  const order = await getMercadoPagoOrder(orderId);
  if (!isMercadoPagoOrderAuthorized(order)) return;

  await mercadoPagoRequest(`/v1/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function releaseMercadoPagoOrder(orderId: string) {
  const order = await getMercadoPagoOrder(orderId);
  if (!isMercadoPagoOrderAuthorized(order)) return;

  try {
    await mercadoPagoRequest(`/v1/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.error("[mercadopago] Failed to release authorized order:", error);
  }
}
