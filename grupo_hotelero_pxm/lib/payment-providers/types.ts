export type PaymentProviderId = "conekta" | "mercadopago";

export type CheckoutSession = {
  provider: PaymentProviderId;
  checkoutUrl?: string;
  paymentPageUrl?: string;
  orderId: string;
};

export type AuthorizedPaymentState = {
  authorized: boolean;
  orderId: string;
  referenceId?: string;
};
