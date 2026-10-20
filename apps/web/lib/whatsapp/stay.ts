import type { Booking, Hotel, Listing } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { samePhone } from "@/lib/whatsapp/phone";

export type StayBooking = Booking & { listing: Listing & { hotel: Hotel } };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Confirmed booking for this phone that hasn't ended more than a day ago, nearest first. */
export async function findStayByPhone(phone: string, now = new Date()): Promise<StayBooking | null> {
  const candidates = await prisma.booking.findMany({
    where: { status: "CONFIRMED", endDate: { gte: new Date(now.getTime() - DAY_MS) } },
    include: { listing: { include: { hotel: true } } },
    orderBy: { startDate: "asc" },
  });
  return candidates.find((b) => samePhone(b.guestPhone, phone)) ?? null;
}

export function isVerifiedGuest(
  conversation: { bookingId: string | null; roomVerifiedUntil: Date | null },
  now = new Date()
) {
  if (conversation.bookingId) return true;
  return Boolean(conversation.roomVerifiedUntil && conversation.roomVerifiedUntil > now);
}

export function formatStayDate(date: Date, locale: "es" | "en") {
  return date.toLocaleDateString(locale === "en" ? "en-US" : "es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
