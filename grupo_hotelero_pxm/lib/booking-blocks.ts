import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Bookings that should block dates on the site and in the outbound iCal feed:
 * - CONFIRMED bookings
 * - PENDING bookings with payment authorized (authorizedAt set)
 *
 * Unpaid PENDING bookings (checkout not completed) do NOT block dates.
 */
export const blockingBookingStatusWhere: Prisma.BookingWhereInput = {
  OR: [
    { status: "CONFIRMED" },
    { status: "PENDING", authorizedAt: { not: null } },
  ],
};

export function blockingBookingWhere(
  listingId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
): Prisma.BookingWhereInput {
  return {
    listingId,
    ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    NOT: [{ endDate: { lte: startDate } }, { startDate: { gte: endDate } }],
    ...blockingBookingStatusWhere,
  };
}

export async function countBlockingLocalConflicts(
  listingId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
) {
  return prisma.booking.count({
    where: blockingBookingWhere(listingId, startDate, endDate, excludeBookingId),
  });
}

export async function hasBlockingLocalConflict(
  listingId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
) {
  return (await countBlockingLocalConflicts(listingId, startDate, endDate, excludeBookingId)) > 0;
}

export async function cancelUnpaidPendingBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, authorizedAt: true },
  });

  if (!booking || booking.status !== "PENDING" || booking.authorizedAt) {
    return false;
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELED",
      cancelReason: "Checkout was not completed in time.",
    },
  });

  return true;
}

/** Cancel unpaid PENDING bookings whose checkout window expired. */
export async function expireStaleUnpaidBookings(listingId?: string) {
  const now = new Date();
  const stale = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      authorizedAt: null,
      pendingExpiresAt: { lt: now },
      ...(listingId ? { listingId } : {}),
    },
    select: { id: true },
  });

  for (const booking of stale) {
    await cancelUnpaidPendingBooking(booking.id);
  }

  return stale.length;
}
