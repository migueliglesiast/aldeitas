// Reconcile all pending authorized bookings (same logic as /api/bookings/reconcile).
// Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reconcile-pending-bookings.ts

import { reconcilePendingBookings } from "../lib/booking-reconcile";
import { expireStaleUnpaidBookings } from "../lib/booking-blocks";

async function main() {
  const expired = await expireStaleUnpaidBookings();
  if (expired > 0) {
    console.log(`Expired ${expired} unpaid checkout booking(s).`);
  }

  const results = await reconcilePendingBookings();
  if (results.length === 0) {
    console.log("No pending authorized bookings.");
    return;
  }

  for (const result of results) {
    console.log(`${result.action}: ${result.bookingId}`, "message" in result ? result.message : "");
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
