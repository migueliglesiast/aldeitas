import { NextRequest, NextResponse } from "next/server";
import {
  listHotelsForAirbnbPriceSync,
  syncHotelAirbnbPrices,
  syncNextHotelAirbnbPrices,
} from "@/lib/sync-airbnb-prices";

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

async function runSync(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hotelId = req.nextUrl.searchParams.get("hotelId") || undefined;
  const listOnly = req.nextUrl.searchParams.get("list") === "1";
  const monthsParam = Number(req.nextUrl.searchParams.get("months") || "3");
  const sampleEveryParam = Number(
    req.nextUrl.searchParams.get("sampleEvery") || "3"
  );
  const months =
    Number.isFinite(monthsParam) && monthsParam >= 1 && monthsParam <= 6
      ? monthsParam
      : 3;
  const sampleEvery =
    Number.isFinite(sampleEveryParam) && sampleEveryParam >= 1
      ? sampleEveryParam
      : 3;

  if (listOnly) {
    const hotels = await listHotelsForAirbnbPriceSync();
    return NextResponse.json({ hotels });
  }

  // Optional: sync every hotel in one request (may time out on free cron hosts).
  if (req.nextUrl.searchParams.get("all") === "1") {
    const hotels = await listHotelsForAirbnbPriceSync();
    const results = [];
    for (const hotel of hotels) {
      results.push(
        await syncHotelAirbnbPrices(hotel.id, { months, sampleEvery })
      );
    }
    return NextResponse.json({
      ok: true,
      mode: "all",
      results,
      message: `Synced ${results.length} hotel(s).`,
    });
  }

  const result = await syncNextHotelAirbnbPrices({
    hotelId,
    months,
    sampleEvery,
  });

  return NextResponse.json({
    ...result,
    mode: hotelId ? "hotel" : "next",
  });
}

/** cron-job.org and similar services often use GET. */
export async function GET(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: any) {
    console.error("[cron/sync-airbnb-prices]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync Airbnb prices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
