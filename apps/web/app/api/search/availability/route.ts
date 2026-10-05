import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockingBookingStatusWhere } from "@/lib/booking-blocks";
import { getStorefrontHotel } from "@/lib/storefront";
import {
  checkExternalAvailability,
  hasExternalCalendars,
} from "@/lib/external-calendars";

export async function POST(req: NextRequest) {
  try {
    const { checkIn, checkOut } = await req.json();

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { error: "checkIn and checkOut dates are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const overlapsStay = {
      NOT: [{ endDate: { lte: startDate } }, { startDate: { gte: endDate } }],
    };

    const storefront = await getStorefrontHotel(
      req.headers.get("x-storefront-host") ?? req.headers.get("host")
    );

    const hotels = await prisma.hotel.findMany({
      where: storefront ? { id: storefront.id } : undefined,
      include: {
        listings: {
          include: {
            calendarSources: true,
            bookings: {
              where: {
                ...blockingBookingStatusWhere,
                ...overlapsStay,
              },
            },
            manualBlocks: { where: overlapsStay },
          },
        },
      },
    });

    const listings = hotels.flatMap((hotel) => hotel.listings);
    const availability = await Promise.all(
      listings.map(async (listing) => {
        if (listing.bookings.length > 0 || listing.manualBlocks.length > 0) return false;
        if (!hasExternalCalendars(listing)) return true;
        const { status } = await checkExternalAvailability(
          listing,
          startDate,
          endDate,
          `[search] listing ${listing.id}:`
        );
        return status === "available";
      })
    );

    return NextResponse.json({
      listingIds: listings.filter((_, index) => availability[index]).map((l) => l.id),
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
