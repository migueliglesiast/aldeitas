import type { PaymentProviderId } from "@/lib/payment-providers/types";

const PROVIDER_ORDER: PaymentProviderId[] = ["mercadopago", "conekta"];

export function isConektaConfigured() {
  return Boolean(process.env.CONEKTA_PRIVATE_KEY);
}

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function parsePreferredProvider(): PaymentProviderId | null {
  const raw = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (raw === "mercadopago" || raw === "conekta") {
    return raw;
  }
  return null;
}

export function getConfiguredPaymentProviders(): PaymentProviderId[] {
  const preferred = parsePreferredProvider();
  if (preferred && isPaymentProviderConfigured(preferred)) {
    return [preferred];
  }

  return PROVIDER_ORDER.filter(isPaymentProviderConfigured);
}

export function getDefaultPaymentProvider(): PaymentProviderId | undefined {
  return getConfiguredPaymentProviders()[0];
}

export function isPaymentProviderConfigured(provider: PaymentProviderId) {
  if (provider === "conekta") return isConektaConfigured();
  return isMercadoPagoConfigured();
}

export function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";
}
