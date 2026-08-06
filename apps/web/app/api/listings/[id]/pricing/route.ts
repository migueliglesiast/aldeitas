import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDynamicPricing } from "@/lib/airbnb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      where: { id },
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

    const nightlyCents = dynamic?.nightlyCents ?? listing.nightlyBasePrice;
    const currency = dynamic?.currency ?? listing.baseCurrency;
    const totalCents = Math.round(nightlyCents * nights);

    return NextResponse.json({
      nights,
      nightlyCents,
      totalCents,
      currency,
      basePriceCents: listing.nightlyBasePrice,
      baseCurrency: listing.baseCurrency,
      isDynamic: !!dynamic,
    });
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

