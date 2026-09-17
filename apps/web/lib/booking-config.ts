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
