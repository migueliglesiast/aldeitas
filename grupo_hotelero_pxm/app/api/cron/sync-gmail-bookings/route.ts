import { NextRequest, NextResponse } from "next/server";
import { syncAllConnectedGmailHotels } from "@/lib/gmail-booking-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.BOOKING_RECONCILE_SECRET &&
    !process.env.CRON_SECRET &&
    !process.env.AIRBNB_PRICE_SYNC_SECRET
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

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default: one hotel per hit (stalest first) so Hostinger / free cron stay under timeout.
  // Pass all=1 to sync every connected hotel in one request.
  const all = req.nextUrl.searchParams.get("all") === "1";
  const results = await syncAllConnectedGmailHotels({ oneHotel: !all });
  return NextResponse.json({
    ok: true,
    mode: all ? "all" : "next",
    count: results.length,
    results,
    message: all
      ? `Synced Gmail for ${results.length} hotel(s).`
      : results[0]
        ? `Synced Gmail for ${"hotelName" in results[0] ? results[0].hotelName : "1 hotel"}.`
        : "No hotels with Gmail connected.",
  });
}

export async function GET(req: NextRequest) {
  try {
    return await run(req);
  } catch (error: any) {
    console.error("[cron/sync-gmail-bookings]", error);
    return NextResponse.json(
      { error: error?.message || "Gmail sync failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
