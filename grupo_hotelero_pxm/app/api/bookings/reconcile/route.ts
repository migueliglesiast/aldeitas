import { NextRequest, NextResponse } from "next/server";
import { reconcileBooking, reconcilePendingBookings } from "@/lib/booking-reconcile";
import { expireStaleUnpaidBookings } from "@/lib/booking-blocks";

function isAuthorized(req: NextRequest) {
  if (process.env.NODE_ENV === "development" && !process.env.BOOKING_RECONCILE_SECRET) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }

  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!secret) return false;

  const headerSecret = req.headers.get("x-booking-reconcile-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

async function runReconcile(req: NextRequest) {
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

/** External cron services may use GET on this path. */
export async function GET(req: NextRequest) {
  return runReconcile(req);
}

export async function POST(req: NextRequest) {
  return runReconcile(req);
}
