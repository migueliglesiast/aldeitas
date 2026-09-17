import { isBefore } from "date-fns";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import { sendBookingProcessingEmail } from "@/lib/booking-email";
import {
  cancelBooking,
  reconcileBooking,
  snapshotExternalBlocksForListing,
} from "@/lib/booking-reconcile";
import { hasBlockingLocalConflict, cancelUnpaidPendingBooking } from "@/lib/booking-blocks";
import {
  getProviderAuthorizationState,
} from "@/lib/payment-providers";
import type { PaymentProviderId } from "@/lib/payment-providers/types";

async function bookingHasExternalConflict(
  listing: {
    icalUrl: string | null;
    calendarSources: { icalUrl: string; name: string }[];
  },
  startDate: Date,
  endDate: Date
) {
  const sources = [
    ...(listing.icalUrl ? [{ name: "legacy", icalUrl: listing.icalUrl }] : []),
    ...listing.calendarSources,
  ];

  for (const source of sources) {
    try {
      const blocks = await fetchIcalBlocks(source.icalUrl);
      const conflict = blocks.some(
        (block) => isBefore(startDate, block.end) && isBefore(block.start, endDate)
      );
      if (conflict) return true;
    } catch (error) {
      console.error(`[booking-payment] Failed to check ${source.name}:`, error);
    }
  }

  return false;
}

async function bookingHasLocalConflict(bookingId: string, listingId: string, startDate: Date, endDate: Date) {
  return hasBlockingLocalConflict(listingId, startDate, endDate, bookingId);
}

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

  const hasLocalConflict = await bookingHasLocalConflict(
    booking.id,
    booking.listingId,
    booking.startDate,
    booking.endDate
  );
  const hasExternalConflict = await bookingHasExternalConflict(
    booking.listing,
    booking.startDate,
    booking.endDate
  );

  if (hasLocalConflict || hasExternalConflict) {
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
      "Those dates became unavailable before we could secure your booking. We are sorry for the inconvenience."
    );
    return conflictBooking;
  }

  const snapshot = await snapshotExternalBlocksForListing(booking.listing);

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
