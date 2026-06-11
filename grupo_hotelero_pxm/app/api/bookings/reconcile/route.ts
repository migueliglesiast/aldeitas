import { NextRequest, NextResponse } from "next/server";
import { reconcileBooking, reconcilePendingBookings } from "@/lib/booking-reconcile";
import { expireStaleUnpaidBookings } from "@/lib/booking-blocks";

function isAuthorized(req: NextRequest) {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";

  const headerSecret = req.headers.get("x-booking-reconcile-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  const expired = await expireStaleUnpaidBookings();

  if (bookingId) {
    const result = await reconcileBooking(bookingId);
    return NextResponse.json({ expiredUnpaid: expired, results: [result] });
  }

  const results = await reconcilePendingBookings();
  return NextResponse.json({ expiredUnpaid: expired, results });
}
