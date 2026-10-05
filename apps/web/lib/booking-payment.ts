import { prisma } from "@/lib/prisma";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import { sendBookingProcessingEmail } from "@/lib/booking-email";
import {
  cancelBooking,
  reconcileBooking,
  serializeBlocks,
} from "@/lib/booking-reconcile";
import { hasLocalDateConflict, cancelUnpaidPendingBooking } from "@/lib/booking-blocks";
import { checkExternalAvailability } from "@/lib/external-calendars";
import {
  getProviderAuthorizationState,
} from "@/lib/payment-providers";
import type { PaymentProviderId } from "@/lib/payment-providers/types";

const DATES_TAKEN_REASON =
  "Those dates became unavailable before we could secure your booking. We are sorry for the inconvenience.";
const DATES_UNVERIFIABLE_REASON =
  "We couldn't confirm those dates with the property's calendar, so your card was not charged. Please try again in a few minutes.";

async function finalizeAuthorizedBooking(
  bookingId: string,
  provider: PaymentProviderId,
  orderId: string,
  referenceId?: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: {
        include: { calendarSources: true },
      },
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "PENDING") {
    return booking;
  }

  if (booking.authorizedAt) {
    return booking;
  }

  const hasLocalConflict = await hasLocalDateConflict(
    booking.listingId,
    booking.startDate,
    booking.endDate,
    booking.id
  );
  const external = hasLocalConflict
    ? null
    : await checkExternalAvailability(
        booking.listing,
        booking.startDate,
        booking.endDate,
        "[booking-payment]"
      );

  if (!external || external.status !== "available") {
    const conflictBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentProvider: provider,
        paymentOrderId: orderId,
        paymentReference: referenceId,
      },
      include: {
        listing: {
          include: { calendarSources: true },
        },
      },
    });

    await cancelBooking(
      conflictBooking,
      external?.status === "unverifiable" ? DATES_UNVERIFIABLE_REASON : DATES_TAKEN_REASON
    );
    return conflictBooking;
  }

  const snapshot = serializeBlocks(external.result.blocks);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentProvider: provider,
      paymentOrderId: orderId,
      paymentReference: referenceId,
      authorizedAt: new Date(),
      pendingExpiresAt: new Date(Date.now() + getBookingMaxPendingMs()),
      externalBlocksSnapshot: JSON.stringify(snapshot),
    },
    include: { listing: true },
  });

  await sendBookingProcessingEmail(updated);
  await reconcileBooking(bookingId);

  return updated;
}

export async function markBookingAuthorizedFromPaymentOrder(
  provider: PaymentProviderId,
  orderId: string,
  bookingId?: string
) {
  const authState = await getProviderAuthorizationState(provider, orderId);
  if (!authState.authorized) {
    throw new Error("Payment is not authorized yet");
  }

  let resolvedBookingId = bookingId;
  if (!resolvedBookingId) {
    const byOrder = await prisma.booking.findFirst({
      where: { paymentOrderId: orderId },
      select: { id: true },
    });
    resolvedBookingId = byOrder?.id;
  }

  if (!resolvedBookingId) {
    throw new Error("Booking not found for payment order");
  }

  return finalizeAuthorizedBooking(
    resolvedBookingId,
    provider,
    orderId,
    authState.referenceId
  );
}

export async function markBookingAuthorizedForBooking(
  bookingId: string,
  provider: PaymentProviderId,
  orderId: string,
  referenceId?: string
) {
  const authState = await getProviderAuthorizationState(provider, orderId);
  if (!authState.authorized) {
    throw new Error("Payment is not authorized yet");
  }

  return finalizeAuthorizedBooking(
    bookingId,
    provider,
    orderId,
    referenceId || authState.referenceId
  );
}

export async function cancelBookingForExpiredCheckout(bookingId: string) {
  await cancelUnpaidPendingBooking(bookingId);
}
