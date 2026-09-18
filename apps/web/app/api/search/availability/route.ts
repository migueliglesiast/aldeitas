import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";
import { isBefore } from "date-fns";

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

    const hotels = await prisma.hotel.findMany({
      include: {
        listings: {
          include: {
            calendarSources: true,
            bookings: {
              where: {
                status: { in: ["PENDING", "CONFIRMED"] },
                NOT: [{ endDate: { lte: startDate } }, { startDate: { gte: endDate } }],
              },
            },
          },
        },
      },
    });

    const availableListingIds: string[] = [];

    for (const hotel of hotels) {
      for (const listing of hotel.listings) {
        const hasCalendarSources =
          listing.calendarSources.length > 0 || Boolean(listing.icalUrl);

        if (!hasCalendarSources) continue;
        if (listing.bookings.length > 0) continue;

        let available = true;

        if (listing.icalUrl) {
          try {
            const blocks = await fetchIcalBlocks(listing.icalUrl);
            const conflict = blocks.some(
              (b) => isBefore(startDate, b.end) && isBefore(b.start, endDate)
            );
            if (conflict) available = false;
          } catch (error) {
            console.error(`Error checking calendar for listing ${listing.id}:`, error);
            available = false;
          }
        }

        if (!available) continue;

        for (const calendarSource of listing.calendarSources) {
          try {
            const blocks = await fetchIcalBlocks(calendarSource.icalUrl);
            const conflict = blocks.some(
              (b) => isBefore(startDate, b.end) && isBefore(b.start, endDate)
            );
            if (conflict) {
              available = false;
              break;
            }
          } catch (error) {
            console.error(`Error checking calendar ${calendarSource.name}:`, error);
            available = false;
            break;
          }
        }

        if (available) availableListingIds.push(listing.id);
      }
    }

    return NextResponse.json({ listingIds: availableListingIds });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
