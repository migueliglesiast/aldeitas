import { prisma } from "@/lib/prisma";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import { sendBookingProcessingEmail } from "@/lib/booking-email";
import {
  cancelBooking,
  confirmBooking,
  reconcileBooking,
  serializeBlocks,
} from "@/lib/booking-reconcile";
import { hasLocalDateConflict, cancelUnpaidPendingBooking } from "@/lib/booking-blocks";
import { CANCEL_REASON_DATES_TAKEN, CANCEL_REASON_DATES_UNVERIFIABLE } from "@/lib/booking-cancel-reasons";
import { checkExternalAvailability } from "@/lib/external-calendars";
import {
  getProviderAuthorizationState,
} from "@/lib/payment-providers";
import type { PaymentProviderId } from "@/lib/payment-providers/types";


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
        "[booking-payment]",
        "verify"
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
      external?.status === "unverifiable" ? CANCEL_REASON_DATES_UNVERIFIABLE : CANCEL_REASON_DATES_TAKEN
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

/**
 * Re-checks a pending booking's dates (local bookings and every external calendar) before a
 * charge that cannot be held and released, such as a debit card.
 */
export async function verifyBookingDatesAvailable(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { include: { calendarSources: true } } },
  });
  if (!booking || booking.status !== "PENDING") return { ok: false as const, reason: "not_pending" as const };
  if (await hasLocalDateConflict(booking.listingId, booking.startDate, booking.endDate, booking.id)) {
    return { ok: false as const, reason: "taken" as const };
  }
  const external = await checkExternalAvailability(
    booking.listing,
    booking.startDate,
    booking.endDate,
    "[booking-payment]",
    "verify"
  );
  if (external.status !== "available") {
    return { ok: false as const, reason: external.status === "unverifiable" ? ("unverifiable" as const) : ("taken" as const) };
  }
  return { ok: true as const, snapshot: JSON.stringify(serializeBlocks(external.result.blocks)) };
}

/** Records an already-charged payment (dates verified just before) and confirms the booking. */
export async function finalizeCapturedBooking(
  bookingId: string,
  provider: PaymentProviderId,
  orderId: string,
  referenceId: string | undefined,
  externalBlocksSnapshot: string
) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentProvider: provider,
      paymentOrderId: orderId,
      paymentReference: referenceId,
      authorizedAt: new Date(),
      externalBlocksSnapshot,
    },
    include: { listing: { include: { calendarSources: true } } },
  });
  return confirmBooking(booking);
}

export async function cancelBookingForExpiredCheckout(bookingId: string) {
  await cancelUnpaidPendingBooking(bookingId);
}
