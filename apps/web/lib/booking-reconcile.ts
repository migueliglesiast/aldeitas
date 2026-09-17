import { isBefore } from "date-fns";
import type { Booking, Listing } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks, type AvailabilityBlock } from "@/lib/airbnb";
import {
  captureAuthorizedBookingPayment,
  releaseAuthorizedBookingPayment,
} from "@/lib/payment-providers";
import {
  getBookingMaxPendingMs,
  getBookingMinConfirmMs,
} from "@/lib/booking-config";
import { hasBlockingLocalConflict } from "@/lib/booking-blocks";
import {
  sendBookingCanceledEmail,
  sendBookingConfirmedEmail,
} from "@/lib/booking-email";

type BookingWithListing = Booking & { listing: Listing & { calendarSources: { icalUrl: string; name: string }[] } };

export type SerializedBlock = {
  start: string;
  end: string;
};

export type ReconcileResult =
  | { action: "confirmed"; bookingId: string }
  | { action: "canceled"; bookingId: string; reason: string }
  | { action: "pending"; bookingId: string; message: string }
  | { action: "skipped"; bookingId: string; message: string };

function toDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function blocksOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
) {
  return isBefore(a.start, b.end) && isBefore(b.start, a.end);
}

export function serializeBlocks(blocks: AvailabilityBlock[]): SerializedBlock[] {
  return blocks
    .map((block) => ({
      start: block.start.toISOString(),
      end: block.end.toISOString(),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function blockKey(block: SerializedBlock | AvailabilityBlock) {
  const start = block.start instanceof Date ? block.start.toISOString() : block.start;
  const end = block.end instanceof Date ? block.end.toISOString() : block.end;
  return `${start}|${end}`;
}

export function blockMatchesBooking(
  block: AvailabilityBlock,
  booking: Pick<Booking, "startDate" | "endDate">
) {
  return (
    toDateKey(block.start) === toDateKey(booking.startDate) &&
    toDateKey(block.end) === toDateKey(booking.endDate)
  );
}

export function findNewOverlappingBlocks(
  snapshot: SerializedBlock[],
  current: AvailabilityBlock[],
  booking: Pick<Booking, "startDate" | "endDate">
) {
  const snapshotKeys = new Set(snapshot.map(blockKey));

  return current.filter((block) => {
    if (!blocksOverlap(block, { start: booking.startDate, end: booking.endDate })) {
      return false;
    }
    return !snapshotKeys.has(blockKey(block));
  });
}

export async function fetchExternalBlocksForListing(
  listing: Listing & { calendarSources: { icalUrl: string; name: string }[] }
) {
  const blocks: AvailabilityBlock[] = [];
  const sources = [
    ...(listing.icalUrl ? [{ name: "legacy", icalUrl: listing.icalUrl }] : []),
    ...listing.calendarSources,
  ];

  for (const source of sources) {
    try {
      const sourceBlocks = await fetchIcalBlocks(source.icalUrl);
      blocks.push(...sourceBlocks);
    } catch (error) {
      console.error(`[reconcile] Failed to fetch calendar ${source.name}:`, error);
    }
  }

  return blocks;
}

async function captureAuthorizedPayment(booking: Booking) {
  await captureAuthorizedBookingPayment(booking);
}

async function releaseAuthorizedPayment(booking: Booking) {
  await releaseAuthorizedBookingPayment(booking);
}

export async function confirmBooking(booking: BookingWithListing) {
  if (booking.status !== "PENDING") {
    return { action: "skipped" as const, bookingId: booking.id, message: "Not pending" };
  }

  await captureAuthorizedPayment(booking);

  const confirmed = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      lastReconciledAt: new Date(),
    },
    include: { listing: true },
  });

  await sendBookingConfirmedEmail(confirmed);

  return { action: "confirmed" as const, bookingId: booking.id };
}

export async function cancelBooking(
  booking: BookingWithListing,
  reason: string
) {
  if (booking.status !== "PENDING") {
    return { action: "skipped" as const, bookingId: booking.id, message: "Not pending" };
  }

  await releaseAuthorizedPayment(booking);

  const canceled = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELED",
      cancelReason: reason,
      lastReconciledAt: new Date(),
    },
    include: { listing: true },
  });

  await sendBookingCanceledEmail(canceled, reason);

  return { action: "canceled" as const, bookingId: booking.id, reason };
}

export async function reconcileBooking(bookingId: string): Promise<ReconcileResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: {
        include: { calendarSources: true },
      },
    },
  });

  if (!booking) {
    return { action: "skipped", bookingId, message: "Booking not found" };
  }

  if (booking.status !== "PENDING") {
    return { action: "skipped", bookingId, message: `Status is ${booking.status}` };
  }

  if (!booking.authorizedAt) {
    return {
      action: "skipped",
      bookingId,
      message: "Payment has not been authorized yet",
    };
  }

  if (
    await hasBlockingLocalConflict(
      booking.listingId,
      booking.startDate,
      booking.endDate,
      booking.id
    )
  ) {
    return cancelBooking(
      booking,
      "Those dates were reserved by another guest while we processed your request. We are sorry for the inconvenience."
    );
  }

  const snapshot = booking.externalBlocksSnapshot
    ? (JSON.parse(booking.externalBlocksSnapshot) as SerializedBlock[])
    : [];

  const externalBlocks = await fetchExternalBlocksForListing(booking.listing);
  const newBlocks = findNewOverlappingBlocks(snapshot, externalBlocks, booking);
  const conflictingBlocks = newBlocks.filter(
    (block) => !blockMatchesBooking(block, booking)
  );

  await prisma.booking.update({
    where: { id: booking.id },
    data: { lastReconciledAt: new Date() },
  });

  if (conflictingBlocks.length > 0) {
    return cancelBooking(
      booking,
      "Those dates were booked on another channel while we processed your request. We are sorry for the inconvenience."
    );
  }

  const ageMs = Date.now() - booking.authorizedAt.getTime();
  const holdLikelySynced = newBlocks.some((block) =>
    blockMatchesBooking(block, booking)
  );
  const minWaitPassed = ageMs >= getBookingMinConfirmMs();
  const timedOut =
    ageMs >= getBookingMaxPendingMs() ||
    (booking.pendingExpiresAt ? Date.now() >= booking.pendingExpiresAt.getTime() : false);

  if (holdLikelySynced && minWaitPassed) {
    return confirmBooking(booking);
  }

  if (timedOut) {
    return confirmBooking(booking);
  }

  return {
    action: "pending",
    bookingId,
    message: holdLikelySynced
      ? "Almost there — we'll email you as soon as your booking is confirmed."
      : "We're confirming your dates right now. We'll email you as soon as the processing is complete.",
  };
}

export async function reconcilePendingBookings() {
  const pending = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      authorizedAt: { not: null },
    },
    select: { id: true },
    orderBy: { authorizedAt: "asc" },
  });

  const results: ReconcileResult[] = [];
  for (const booking of pending) {
    results.push(await reconcileBooking(booking.id));
  }

  return results;
}

export async function snapshotExternalBlocksForListing(
  listing: Listing & { calendarSources: { icalUrl: string; name: string }[] }
) {
  const blocks = await fetchExternalBlocksForListing(listing);
  return serializeBlocks(blocks);
}
