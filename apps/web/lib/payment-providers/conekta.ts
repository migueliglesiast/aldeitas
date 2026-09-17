import type { AuthorizedPaymentState } from "@/lib/payment-providers/types";
import { isConektaConfigured } from "@/lib/payment-providers/config";

const CONEKTA_API = "https://api.conekta.io";
const CONEKTA_VERSION = "application/vnd.conekta-v2.2.0+json";

type ConektaOrder = {
  id: string;
  payment_status?: string;
  metadata?: Record<string, string>;
  charges?: {
    data?: Array<{
      id?: string;
      status?: string;
    }>;
  };
  checkout?: {
    id?: string;
    url?: string;
  };
};

async function conektaRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const key = process.env.CONEKTA_PRIVATE_KEY;
  if (!key) {
    throw new Error("Conekta is not configured");
  }

  const response = await fetch(`${CONEKTA_API}${path}`, {
    ...options,
    headers: {
      Accept: CONEKTA_VERSION,
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.details?.[0]?.message === "string"
        ? payload.details[0].message
        : payload?.message || `Conekta request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

function getPrimaryCharge(order: ConektaOrder) {
  return order.charges?.data?.[0];
}

export function isConektaOrderAuthorized(order: ConektaOrder) {
  const charge = getPrimaryCharge(order);
  if (charge?.status === "pre_authorized") return true;
  return order.payment_status === "pre_authorized";
}

export async function createConektaHostedCheckout(params: {
  bookingId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerPhone: string;
  successUrl: string;
  failureUrl: string;
}) {
  if (!isConektaConfigured()) {
    throw new Error("Conekta is not configured");
  }

  const order = await conektaRequest<ConektaOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      currency: params.currency.toUpperCase(),
      customer_info: {
        name: "Guest",
        email: params.customerEmail,
        phone: params.customerPhone,
      },
      line_items: [
        {
          name: params.description.slice(0, 250),
          unit_price: params.amountCents,
          quantity: 1,
        },
      ],
      metadata: {
        booking_id: params.bookingId,
      },
      pre_authorize: true,
      checkout: {
        type: "HostedPayment",
        allowed_payment_methods: ["card"],
        success_url: params.successUrl,
        failure_url: params.failureUrl,
      },
    }),
  });

  if (!order.checkout?.url) {
    throw new Error("Conekta checkout URL was not returned");
  }

  return {
    orderId: order.id,
    checkoutUrl: order.checkout.url,
  };
}

export async function getConektaOrder(orderId: string) {
  return conektaRequest<ConektaOrder>(`/orders/${orderId}`);
}

export async function getConektaAuthorizationState(
  orderId: string
): Promise<AuthorizedPaymentState> {
  const order = await getConektaOrder(orderId);
  const charge = getPrimaryCharge(order);

  return {
    authorized: isConektaOrderAuthorized(order),
    orderId: order.id,
    referenceId: charge?.id,
  };
}

export async function captureConektaOrder(orderId: string) {
  const order = await getConektaOrder(orderId);
  if (!isConektaOrderAuthorized(order)) return;

  await conektaRequest(`/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function releaseConektaOrder(orderId: string) {
  const order = await getConektaOrder(orderId);
  if (!isConektaOrderAuthorized(order)) return;

  try {
    await conektaRequest(`/orders/${orderId}`, { method: "DELETE" });
  } catch (error) {
    console.error("[conekta] Failed to release pre-authorized order:", error);
  }
}

export function getConektaBookingIdFromOrder(order: ConektaOrder) {
  return order.metadata?.booking_id;
}
