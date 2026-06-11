import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  markBookingAuthorizedFromPaymentOrder,
} from "@/lib/booking-payment";
import { reconcileBooking } from "@/lib/booking-reconcile";
import type { PaymentProviderId } from "@/lib/payment-providers/types";
import {
  isMercadoPagoSandbox,
  resolveMercadoPagoCharge,
  resolveMercadoPagoPayerEmail,
} from "@/lib/payment-providers/mercadopago";

function publicBookingStatus(booking: {
  id: string;
  status: string;
  guestEmail: string;
  startDate: Date;
  endDate: Date;
  totalPriceCents: number;
  currency: string;
  paymentProvider: string | null;
  authorizedAt: Date | null;
  confirmedAt: Date | null;
  pendingExpiresAt: Date | null;
  cancelReason: string | null;
  lastReconciledAt: Date | null;
  listing: { title: string; id: string };
}) {
  const isAwaitingPayment = booking.status === "PENDING" && !booking.authorizedAt;
  const isProcessing = booking.status === "PENDING" && !!booking.authorizedAt;

  return {
    id: booking.id,
    status: booking.status,
    guestEmail: booking.guestEmail,
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    totalPriceCents: booking.totalPriceCents,
    currency: booking.currency,
    paymentProvider: booking.paymentProvider,
    authorizedAt: booking.authorizedAt?.toISOString() ?? null,
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    pendingExpiresAt: booking.pendingExpiresAt?.toISOString() ?? null,
    cancelReason: booking.cancelReason,
    lastReconciledAt: booking.lastReconciledAt?.toISOString() ?? null,
    listing: booking.listing,
    isAwaitingPayment,
    isProcessing,
    paymentCaptured: booking.status === "CONFIRMED",
    message: isAwaitingPayment
      ? "One last step — add your card to hold these dates. You’ll only be charged if we confirm availability."
      : isProcessing
        ? "Thanks! Your card is on hold while we confirm the dates. You won’t be charged unless everything checks out."
        : booking.status === "CONFIRMED"
          ? "You’re all set — your stay is confirmed and payment has been processed."
          : booking.cancelReason ||
            "This booking couldn’t be completed. No charge was made.",
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const provider = req.nextUrl.searchParams.get("provider") as PaymentProviderId | null;
  const orderId = req.nextUrl.searchParams.get("order_id");

  let booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      listing: {
        select: { id: true, title: true },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "PENDING" && !booking.authorizedAt && booking.paymentOrderId) {
    const paymentProvider = (provider || booking.paymentProvider) as PaymentProviderId | null;
    if (paymentProvider === "conekta" || paymentProvider === "mercadopago") {
      try {
        await markBookingAuthorizedFromPaymentOrder(
          paymentProvider,
          orderId || booking.paymentOrderId,
          booking.id
        );
      } catch (error) {
        console.error("[booking-status] Failed to authorize from payment order:", error);
      }
    }

    booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: { id: true, title: true },
        },
      },
    });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  let reconcileMessage: string | null = null;
  if (booking.status === "PENDING" && booking.authorizedAt) {
    const result = await reconcileBooking(booking.id);
    reconcileMessage = result.action === "pending" ? result.message : null;

    booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: { id: true, title: true },
        },
      },
    });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const mercadoPagoCharge = resolveMercadoPagoCharge(
    booking.totalPriceCents,
    booking.currency
  );

  return NextResponse.json({
    ...publicBookingStatus(booking),
    reconcileMessage,
    mercadoPagoPayerEmail: resolveMercadoPagoPayerEmail(booking.guestEmail),
    mercadoPagoChargeAmountCents: mercadoPagoCharge.amountCents,
    mercadoPagoChargeCurrency: mercadoPagoCharge.currency,
    mercadoPagoSandbox: isMercadoPagoSandbox(),
  });
}
