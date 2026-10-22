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

const MANUAL_CAPTURE_BRANDS = new Set(["visa", "master", "amex"]);
const CARD_TYPES = new Set(["credit_card", "debit_card", "prepaid_card"]);

/**
 * Mercado Pago can only reserve (manual capture) Visa, Mastercard and Amex credit cards;
 * debit and prepaid cards must be charged at once.
 */
export function resolveCardPaymentMethod(paymentMethodId: string, paymentTypeId?: string | null) {
  const raw = paymentMethodId.trim().toLowerCase();
  const id = raw === "mastercard" ? "master" : raw;
  const type = paymentTypeId && CARD_TYPES.has(paymentTypeId) ? paymentTypeId : id.startsWith("deb") ? "debit_card" : "credit_card";
  return { id, type, manualCapture: type === "credit_card" && MANUAL_CAPTURE_BRANDS.has(id) };
}

/** Error whose `guestMessage` is safe and helpful to show at checkout (Spanish / English). */
export class MercadoPagoPaymentError extends Error {
  constructor(message: string, readonly guestMessage: string) {
    super(message);
  }
}

/** Turns a Mercado Pago error or rejection detail into a bilingual message for the guest. */
export function guestPaymentErrorMessage(detail: string | null | undefined) {
  const code = (detail || "").toLowerCase();
  if (code.includes("insufficient")) {
    return "Fondos insuficientes. Prueba con otra tarjeta. / Insufficient funds, please try another card.";
  }
  if (code.includes("call_for_authorize")) {
    return "Tu banco pide autorizar este pago: llámales o usa otra tarjeta. / Your bank needs to approve this payment: call them or use another card.";
  }
  if (code.includes("bad_filled") || code.includes("security_code") || code.includes("expiration") || code.includes("card_number")) {
    return "Revisa el número, la fecha de vencimiento y el CVV. / Please check the card number, expiry date and CVV.";
  }
  if (code.includes("high_risk") || code.includes("blacklist")) {
    return "El sistema antifraude de Mercado Pago rechazó esta tarjeta; tu banco no hizo ningún cargo. Prueba con una tarjeta de crédito o escríbenos por WhatsApp. / Mercado Pago's fraud check declined this card; nothing was charged. Please try a credit card or message us on WhatsApp.";
  }
  if (code.includes("3ds") || code.includes("challenge")) {
    return "Tu banco no pudo verificar el pago. Inténtalo de nuevo o usa otra tarjeta. / Your bank couldn't verify the payment. Please try again or use another card.";
  }
  if (code.includes("duplicated")) {
    return "Este pago ya se intentó hace un momento. Espera un minuto o usa otra tarjeta. / This payment was just attempted; wait a minute or use another card.";
  }
  return "No pudimos procesar el pago con esta tarjeta. Prueba con otra tarjeta o escríbenos por WhatsApp. / We couldn't process this card. Please try another card or message us on WhatsApp.";
}

function formatMercadoPagoApiError(payload: Record<string, unknown>, status: number) {
  const errors = payload?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const details = errors
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const item = entry as { code?: string; message?: string; details?: unknown };
        const extra = Array.isArray(item.details) ? item.details.filter((d) => typeof d === "string").join(", ") : "";
        return [item.code, item.message, extra].filter(Boolean).join(": ");
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
      payment_method?: { transaction_security?: { url?: string } };
    }>;
  };
};

function formatAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

async function mercadoPagoRequest<T>(
  path: string,
  options: RequestInit = {},
  { acceptActionRequired = false } = {}
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
  if (!response.ok && !(acceptActionRequired && payload?.status === "action_required")) {
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

export function isMercadoPagoOrderCaptured(order: MercadoPagoOrder) {
  const payment = getPrimaryPayment(order);
  return order.status === "processed" || payment?.status === "processed";
}

/** Bank 3DS verification the guest must complete before the payment is decided. */
export function getMercadoPagoChallengeUrl(order: MercadoPagoOrder) {
  const payment = getPrimaryPayment(order);
  const pending =
    (order.status === "action_required" && order.status_detail === "pending_challenge") ||
    (payment?.status === "action_required" && payment?.status_detail === "pending_challenge");
  return pending ? payment?.payment_method?.transaction_security?.url || null : null;
}

export function isMercadoPagoOrderFinalFailure(order: MercadoPagoOrder) {
  return Boolean(order.status && RELEASE_FINAL_STATUSES.has(order.status) && order.status !== "processed");
}

function splitName(fullName: string | null | undefined) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return {};
  return { first_name: parts.slice(0, -1).join(" ").slice(0, 60), last_name: parts[parts.length - 1].slice(0, 60) };
}

function is3dsEnabled() {
  return process.env.MERCADOPAGO_3DS !== "false";
}

/**
 * Credit cards are reserved and captured once the dates are confirmed; other cards are charged
 * immediately (`captured: true`), so callers must verify availability before calling this.
 */
export async function createMercadoPagoAuthorizedOrder(params: {
  bookingId: string;
  amountCents: number;
  currency: string;
  payerEmail: string;
  cardToken: string;
  paymentMethodId: string;
  paymentTypeId?: string | null;
  installments?: number;
  deviceId?: string | null;
  payerName?: string | null;
  item?: { title: string; description: string; pictureUrl?: string | null };
}) {
  if (!isMercadoPagoConfigured()) {
    throw new Error("Mercado Pago is not configured");
  }

  const charge = resolveMercadoPagoCharge(params.amountCents, params.currency);
  const payerEmail = resolveMercadoPagoPayerEmail(params.payerEmail);
  const amount = formatAmount(charge.amountCents);
  const method = resolveCardPaymentMethod(params.paymentMethodId, params.paymentTypeId);

  let order: MercadoPagoOrder;
  try {
    order = await mercadoPagoRequest<MercadoPagoOrder>("/v1/orders", {
      method: "POST",
      body: JSON.stringify({
        capture_mode: method.manualCapture ? "manual" : "automatic",
        type: "online",
        external_reference: params.bookingId,
        processing_mode: "automatic",
        marketplace: "NONE",
        total_amount: amount,
        currency: charge.currency,
        description: params.item?.title.slice(0, 120),
        payer: {
          email: payerEmail,
          ...splitName(params.payerName),
        },
        ...(params.item
          ? {
              items: [
                {
                  title: params.item.title.slice(0, 120),
                  description: params.item.description.slice(0, 250),
                  ...(params.item.pictureUrl?.startsWith("https://") ? { picture_url: params.item.pictureUrl } : {}),
                  category_id: "travel",
                  quantity: 1,
                  unit_price: amount,
                  external_code: params.bookingId,
                },
              ],
            }
          : {}),
        ...(is3dsEnabled()
          ? { config: { online: { transaction_security: { validation: "on_fraud_risk", liability_shift: "required" } } } }
          : {}),
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: method.id,
                type: method.type,
                token: params.cardToken,
                installments: params.installments || 1,
              },
            },
          ],
        },
      }),
      ...(params.deviceId ? { headers: { "X-meli-session-id": params.deviceId } } : {}),
    }, { acceptActionRequired: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MercadoPagoPaymentError(message, guestPaymentErrorMessage(message));
  }

  const payment = getPrimaryPayment(order);
  const challengeUrl = getMercadoPagoChallengeUrl(order);
  if (challengeUrl) {
    return { orderId: order.id, referenceId: payment?.id, captured: false, challengeUrl };
  }
  const ok = method.manualCapture ? isMercadoPagoOrderAuthorized(order) : isMercadoPagoOrderCaptured(order);
  if (!ok) {
    const detail = payment?.status_detail || order.status_detail || order.status || "unknown";
    if (order.id) await releaseMercadoPagoOrder(order.id);
    throw new MercadoPagoPaymentError(`Mercado Pago did not accept the payment: ${detail}`, guestPaymentErrorMessage(detail));
  }

  return {
    orderId: order.id,
    referenceId: payment?.id,
    captured: !method.manualCapture,
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

const RELEASE_FINAL_STATUSES = new Set(["canceled", "refunded", "processed", "failed", "expired"]);
const RELEASE_ATTEMPTS = 3;

export async function releaseMercadoPagoOrder(orderId: string) {
  for (let attempt = 1; attempt <= RELEASE_ATTEMPTS; attempt++) {
    try {
      const order = await getMercadoPagoOrder(orderId);
      if (order.status && RELEASE_FINAL_STATUSES.has(order.status)) return;

      await mercadoPagoRequest(`/v1/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      return;
    } catch (error) {
      if (attempt === RELEASE_ATTEMPTS) {
        console.error("[mercadopago] Failed to release authorized order:", error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}
