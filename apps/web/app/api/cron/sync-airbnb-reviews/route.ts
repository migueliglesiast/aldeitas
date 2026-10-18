import { NextRequest, NextResponse } from "next/server";
import { syncAirbnbReviews } from "@/lib/sync-airbnb-reviews";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.AIRBNB_PRICE_SYNC_SECRET &&
    !process.env.BOOKING_RECONCILE_SECRET &&
    !process.env.CRON_SECRET
  ) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }

  const secret =
    process.env.AIRBNB_PRICE_SYNC_SECRET || process.env.BOOKING_RECONCILE_SECRET;
  if (!secret) return false;

  const headerSecret =
    req.headers.get("x-airbnb-price-sync-secret") ||
    req.headers.get("x-booking-reconcile-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const hotelId = req.nextUrl.searchParams.get("hotelId") || undefined;
    return NextResponse.json({ ok: true, ...(await syncAirbnbReviews({ hotelId })) });
  } catch (error) {
    console.error("[cron/sync-airbnb-reviews]", error);
    return NextResponse.json({ error: "Failed to sync Airbnb reviews" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
