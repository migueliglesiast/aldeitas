export const BOOKING_MIN_CONFIRM_MINUTES = Number(
  process.env.BOOKING_MIN_CONFIRM_MINUTES || 15
);

export const BOOKING_MAX_PENDING_MINUTES = Number(
  process.env.BOOKING_MAX_PENDING_MINUTES || 120
);

export function getBookingMinConfirmMs() {
  return BOOKING_MIN_CONFIRM_MINUTES * 60 * 1000;
}

export function getBookingMaxPendingMs() {
  return BOOKING_MAX_PENDING_MINUTES * 60 * 1000;
}

/**
 * Extra time a held booking may wait for an unreachable external calendar
 * before it is cancelled, on top of BOOKING_MAX_PENDING_MINUTES.
 */
export const BOOKING_CALENDAR_OUTAGE_GRACE_MINUTES = Number(
  process.env.BOOKING_CALENDAR_OUTAGE_GRACE_MINUTES || 360
);

export function getBookingCalendarOutageGraceMs() {
  return BOOKING_CALENDAR_OUTAGE_GRACE_MINUTES * 60 * 1000;
}
