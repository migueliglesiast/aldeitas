export type { PaymentProviderId, CheckoutSession, AuthorizedPaymentState } from "./types";
export {
  getConfiguredPaymentProviders,
  isConektaConfigured,
  isMercadoPagoConfigured,
  isPaymentProviderConfigured,
  getMercadoPagoPublicKey,
} from "./config";
import type { PaymentProviderId } from "./types";
import {
  captureConektaOrder,
  createConektaHostedCheckout,
  getConektaAuthorizationState,
  releaseConektaOrder,
} from "./conekta";
import {
  captureMercadoPagoOrder,
  createMercadoPagoAuthorizedOrder,
  getMercadoPagoAuthorizationState,
  releaseMercadoPagoOrder,
} from "./mercadopago";

type BookingPaymentRecord = {
  paymentProvider: string | null;
  paymentOrderId: string | null;
};

export async function createProviderCheckout(params: {
  provider: PaymentProviderId;
  bookingId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerPhone: string;
  successUrl: string;
  failureUrl: string;
}) {
  if (params.provider === "conekta") {
    const checkout = await createConektaHostedCheckout(params);
    return {
      provider: "conekta" as const,
      orderId: checkout.orderId,
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  return {
    provider: "mercadopago" as const,
    orderId: "",
    paymentPageUrl: `/booking/${params.bookingId}/pay`,
  };
}

export async function createMercadoPagoCardAuthorization(params: {
  bookingId: string;
  amountCents: number;
  currency: string;
  payerEmail: string;
  cardToken: string;
  paymentMethodId: string;
  installments?: number;
}) {
  return createMercadoPagoAuthorizedOrder(params);
}

export async function getProviderAuthorizationState(
  provider: PaymentProviderId,
  orderId: string
) {
  if (provider === "conekta") {
    return getConektaAuthorizationState(orderId);
  }
  return getMercadoPagoAuthorizationState(orderId);
}

export async function captureAuthorizedBookingPayment(booking: BookingPaymentRecord) {
  if (!booking.paymentProvider || !booking.paymentOrderId) return;

  if (booking.paymentProvider === "conekta") {
    await captureConektaOrder(booking.paymentOrderId);
    return;
  }

  if (booking.paymentProvider === "mercadopago") {
    await captureMercadoPagoOrder(booking.paymentOrderId);
  }
}

export async function releaseAuthorizedBookingPayment(booking: BookingPaymentRecord) {
  if (!booking.paymentProvider || !booking.paymentOrderId) return;

  if (booking.paymentProvider === "conekta") {
    await releaseConektaOrder(booking.paymentOrderId);
    return;
  }

  if (booking.paymentProvider === "mercadopago") {
    await releaseMercadoPagoOrder(booking.paymentOrderId);
  }
}
