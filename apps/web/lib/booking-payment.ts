import { prisma } from "@/lib/prisma";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import { sendBookingProcessingEmail } from "@/lib/booking-email";
import { recordBookingEvent } from "@/lib/booking-events";
import {
  cancelBooking,
  confirmBooking,
  reconcileBooking,
  serializeBlocks,
} from "@/lib/booking-reconcile";
import { hasLocalDateConflict, cancelUnpaidPendingBooking } from "@/lib/booking-blocks";
import { CANCEL_REASON_DATES_TAKEN, CANCEL_REASON_DATES_UNVERIFIABLE } from "@/lib/booking-cancel-reasons";
import { cachedExternalAvailability, checkExternalAvailability } from "@/lib/external-calendars";
import {
  getProviderAuthorizationState,
} from "@/lib/payment-providers";
import type { PaymentProviderId } from "@/lib/payment-providers/types";
import {
  getMercadoPagoChallengeUrl,
  getMercadoPagoOrder,
  guestPaymentErrorMessage,
  isMercadoPagoOrderAuthorized,
  isMercadoPagoOrderCaptured,
  isMercadoPagoOrderFinalFailure,
} from "@/lib/payment-providers/mercadopago";


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
  let external = hasLocalConflict
    ? null
    : await checkExternalAvailability(
        booking.listing,
        booking.startDate,
        booking.endDate,
        "[booking-payment]",
        "verify"
      );

  // A held card is not charged until reconcile gets a fresh calendar download,
  // so a calendar outage right now keeps the hold instead of losing the guest.
  let usedCachedCopyFrom: Date | null = null;
  if (external?.status === "unverifiable") {
    const cached = cachedExternalAvailability(booking.listing, booking.startDate, booking.endDate);
    if (cached.status !== "unverifiable") {
      external = cached;
      usedCachedCopyFrom = cached.oldestFetchedAt;
    }
  }

  if (!external || external.status !== "available") {
    await recordBookingEvent(
      bookingId,
      "availability_check",
      "fail",
      hasLocalConflict
        ? "Dates taken by another Aldeitas booking"
        : external?.status === "unverifiable"
          ? "External calendars could not be checked"
          : "Dates taken on another booking site"
    );
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

  if (usedCachedCopyFrom) {
    const minutes = Math.max(1, Math.round((Date.now() - usedCachedCopyFrom.getTime()) / 60000));
    await recordBookingEvent(
      bookingId,
      "availability_check",
      "wait",
      `Booking sites unreachable after card hold; free in their copy from ${minutes} min ago. Nothing is charged until a fresh check`
    );
  } else {
    await recordBookingEvent(bookingId, "availability_check", "ok", "Aldeitas and all external calendars free after card hold");
  }
  await recordBookingEvent(bookingId, "dates_blocked", "ok", "Dates held in Aldeitas and in its iCal export to the booking sites");
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
    await recordBookingEvent(bookingId, "availability_check", "fail", "Before charging: dates taken by another Aldeitas booking");
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
    await recordBookingEvent(
      bookingId,
      "availability_check",
      "fail",
      external.status === "unverifiable"
        ? "Before charging: external calendars could not be checked; nothing charged"
        : "Before charging: dates taken on another booking site; nothing charged"
    );
    return { ok: false as const, reason: external.status === "unverifiable" ? ("unverifiable" as const) : ("taken" as const) };
  }
  await recordBookingEvent(bookingId, "availability_check", "ok", "Before charging: Aldeitas and all external calendars free");
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
  await recordBookingEvent(bookingId, "dates_blocked", "ok", "Dates held in Aldeitas and in its iCal export to the booking sites");
  return confirmBooking(booking);
}

export async function cancelBookingForExpiredCheckout(bookingId: string) {
  await cancelUnpaidPendingBooking(bookingId);
}

export type ChallengeSettlement =
  | { state: "done" }
  | { state: "pending"; challengeUrl: string | null }
  | { state: "failed"; guestMessage: string }
  | { state: "none" };

/**
 * Resolves a Mercado Pago payment that was waiting on the guest's bank verification (3DS):
 * confirms a charge, records a hold, or frees the booking for another card attempt.
 */
export async function settleMercadoPagoChallenge(bookingId: string): Promise<ChallengeSettlement> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      authorizedAt: true,
      paymentProvider: true,
      paymentOrderId: true,
      externalBlocksSnapshot: true,
    },
  });
  if (!booking) return { state: "none" };
  if (booking.authorizedAt || booking.status === "CONFIRMED") return { state: "done" };
  if (booking.status !== "PENDING" || booking.paymentProvider !== "mercadopago" || !booking.paymentOrderId) {
    return { state: "none" };
  }
  const orderId = booking.paymentOrderId;
  const order = await getMercadoPagoOrder(orderId);
  const challengeUrl = getMercadoPagoChallengeUrl(order);
  if (challengeUrl) return { state: "pending", challengeUrl };
  const payment = order.transactions?.payments?.[0];

  if (isMercadoPagoOrderCaptured(order)) {
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, status: "PENDING", authorizedAt: null, paymentOrderId: orderId },
      data: { authorizedAt: new Date() },
    });
    if (claim.count === 0) return { state: "done" };
    await recordBookingEvent(booking.id, "payment_charged", "ok", `Bank verified; Mercado Pago order ${orderId}`);
    await finalizeCapturedBooking(booking.id, "mercadopago", orderId, payment?.id, booking.externalBlocksSnapshot ?? "[]");
    return { state: "done" };
  }

  if (isMercadoPagoOrderAuthorized(order)) {
    await recordBookingEvent(booking.id, "payment_held", "ok", `Bank verified; Mercado Pago order ${orderId}`);
    await markBookingAuthorizedForBooking(booking.id, "mercadopago", orderId, payment?.id);
    return { state: "done" };
  }

  if (isMercadoPagoOrderFinalFailure(order)) {
    const guestMessage = guestPaymentErrorMessage(payment?.status_detail || order.status_detail || order.status);
    const cleared = await prisma.booking.updateMany({
      where: { id: booking.id, paymentOrderId: orderId, authorizedAt: null },
      data: { paymentOrderId: null, paymentReference: null },
    });
    if (cleared.count > 0) await recordBookingEvent(booking.id, "payment_failed", "fail", guestMessage);
    return { state: "failed", guestMessage };
  }

  return { state: "pending", challengeUrl: null };
}
