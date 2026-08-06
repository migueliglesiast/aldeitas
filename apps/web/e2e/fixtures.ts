// Shared fixture data for the Playwright suite and the E2E seed script.
export const E2E_HOTEL = "E2E Beach Hotel";
export const E2E_LISTING = "E2E Ocean Suite";
export const E2E_BLOCKED_LISTING = "E2E Booked Suite";

function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Ranges stay inside the six months rendered by the availability calendar.
export const BLOCKED_START = isoDaysFromToday(40);
export const BLOCKED_MIDDLE = isoDaysFromToday(41);
export const BLOCKED_END = isoDaysFromToday(45);
// Randomised so repeated local runs never collide with bookings they created.
const freeOffset = 80 + Math.floor(Math.random() * 60);
export const FREE_START = isoDaysFromToday(freeOffset);
export const FREE_END = isoDaysFromToday(freeOffset + 3);
