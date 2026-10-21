import { prisma } from "@/lib/prisma";

export type BookingEventStep =
  | "created"
  | "availability_initial"
  | "payment_submitted"
  | "payment_held"
  | "payment_charged"
  | "payment_failed"
  | "availability_check"
  | "dates_blocked"
  | "channel_synced"
  | "payment_captured"
  | "payment_released"
  | "confirmed"
  | "canceled"
  | "email_processing"
  | "email_confirmed"
  | "email_canceled";

export type BookingEventStatus = "ok" | "fail" | "wait" | "info";

/** Appends a step to the booking timeline. Never throws: the timeline must not break a booking. */
export async function recordBookingEvent(
  bookingId: string,
  step: BookingEventStep,
  status: BookingEventStatus,
  detail?: string
) {
  try {
    await prisma.bookingEvent.create({
      data: { bookingId, step, status, detail: detail?.slice(0, 500) },
    });
  } catch (error) {
    console.error("[booking-events] Failed to record", { bookingId, step, status }, error);
  }
}

/** Records a step only the first time it happens for this booking. */
export async function recordBookingEventOnce(
  bookingId: string,
  step: BookingEventStep,
  status: BookingEventStatus,
  detail?: string
) {
  try {
    const existing = await prisma.bookingEvent.findFirst({ where: { bookingId, step }, select: { id: true } });
    if (existing) return;
  } catch (error) {
    console.error("[booking-events] Failed to read", { bookingId, step }, error);
    return;
  }
  await recordBookingEvent(bookingId, step, status, detail);
}
