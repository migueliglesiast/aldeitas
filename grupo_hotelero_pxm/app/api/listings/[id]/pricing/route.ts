import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDynamicPricing } from "@/lib/airbnb";
import { SITE_CURRENCY } from "@/lib/currency";
import { calculateStayTotalCents } from "@/lib/listing-pricing";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { error: "checkIn and checkOut dates are required" },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.findUnique({
      where: { id: params.id },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Try to fetch dynamic pricing from Airbnb API (if configured)
    const dynamic = await fetchDynamicPricing(listing.airbnbId, checkIn, checkOut);

    // Calculate nights using UTC dates to avoid timezone issues
    const checkInDate = new Date(checkIn + 'T00:00:00');
    const checkOutDate = new Date(checkOut + 'T00:00:00');
    const nights = Math.max(
      0,
      Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    if (nights <= 0) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const currency = SITE_CURRENCY;
    const baseNightlyCents =
      dynamic?.currency === SITE_CURRENCY
        ? dynamic.nightlyCents
        : listing.nightlyBasePrice;
    const stayPricing = await calculateStayTotalCents({
      listingId: listing.id,
      basePriceCents: baseNightlyCents,
      startDate: checkInDate,
      endDate: checkOutDate,
    });

    return NextResponse.json({
      nights: stayPricing.nights,
      nightlyCents: Math.round(stayPricing.totalCents / Math.max(stayPricing.nights, 1)),
      totalCents: stayPricing.totalCents,
      currency,
      basePriceCents: listing.nightlyBasePrice,
      baseCurrency: listing.baseCurrency,
      isDynamic: !!dynamic,
    });
  } catch (error: any) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

