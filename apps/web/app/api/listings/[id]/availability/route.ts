import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";

type CalendarSourceDebug = {
  name: string;
  url: string;
  blocksFound?: number;
  datesAdded?: number;
  error?: string;
};

type DebugInfo = {
  listingId: string;
  listingTitle: string;
  calendarSources: number;
  localBookings: number;
  legacyIcalUrl: string | null;
  fetchedDates: {
    fromLocalBookings: number;
    fromLegacyIcal: number;
    fromCalendarSources: CalendarSourceDebug[];
  };
  errors: string[];
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const debug =
      process.env.NODE_ENV !== "production" &&
      req.nextUrl.searchParams.get("debug") === "true";
    const listing = await prisma.listing.findUnique({
      where: { id: params.id },
      include: {
        calendarSources: true,
        bookings: {
          where: {
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const bookedDates = new Set<string>();
    const debugInfo: DebugInfo = {
      listingId: listing.id,
      listingTitle: listing.title,
      calendarSources: listing.calendarSources.length,
      localBookings: listing.bookings.length,
      legacyIcalUrl: listing.icalUrl || null,
      fetchedDates: {
        fromLocalBookings: 0,
        fromLegacyIcal: 0,
        fromCalendarSources: [],
      },
      errors: [] as string[],
    };

    // Add dates from local bookings
    for (const booking of listing.bookings) {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      
      const current = new Date(start);
      while (current < end) {
        const dateStr = current.toISOString().split('T')[0];
        bookedDates.add(dateStr);
        current.setDate(current.getDate() + 1);
      }
    }
    debugInfo.fetchedDates.fromLocalBookings = bookedDates.size;

    // Add dates from legacy icalUrl if it exists
    if (listing.icalUrl) {
      try {
        console.log(`[Availability] Fetching legacy iCal: ${listing.icalUrl}`);
        const blocks = await fetchIcalBlocks(listing.icalUrl);
        console.log(`[Availability] Found ${blocks.length} blocks from legacy iCal`);
        
        let datesAdded = 0;
        for (const block of blocks) {
          const start = new Date(block.start);
          const end = new Date(block.end);
          const current = new Date(start);
          while (current < end) {
            const dateStr = current.toISOString().split('T')[0];
            if (!bookedDates.has(dateStr)) {
              bookedDates.add(dateStr);
              datesAdded++;
            }
            current.setDate(current.getDate() + 1);
          }
        }
        debugInfo.fetchedDates.fromLegacyIcal = datesAdded;
      } catch (error) {
        const errorMsg = `Error fetching legacy iCal ${listing.icalUrl}: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
        console.error(`[Availability] ${errorMsg}`);
        debugInfo.errors.push(errorMsg);
      }
    }

    // Add dates from all calendar sources
    for (const calendarSource of listing.calendarSources) {
      try {
        console.log(`[Availability] Fetching calendar "${calendarSource.name}": ${calendarSource.icalUrl}`);
        const blocks = await fetchIcalBlocks(calendarSource.icalUrl);
        console.log(`[Availability] Found ${blocks.length} blocks from "${calendarSource.name}"`);
        
        let datesAdded = 0;
        for (const block of blocks) {
          const start = new Date(block.start);
          const end = new Date(block.end);
          const current = new Date(start);
          while (current < end) {
            const dateStr = current.toISOString().split('T')[0];
            if (!bookedDates.has(dateStr)) {
              bookedDates.add(dateStr);
              datesAdded++;
            }
            current.setDate(current.getDate() + 1);
          }
        }
        debugInfo.fetchedDates.fromCalendarSources.push({
          name: calendarSource.name,
          url: calendarSource.icalUrl,
          blocksFound: blocks.length,
          datesAdded,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        const errorMsg = `Error fetching calendar "${calendarSource.name}": ${message}`;
        console.error(`[Availability] ${errorMsg}`);
        debugInfo.errors.push(errorMsg);
        debugInfo.fetchedDates.fromCalendarSources.push({
          name: calendarSource.name,
          url: calendarSource.icalUrl,
          error: message,
        });
      }
    }

    const response: {
      bookedDates: string[];
      totalBookedDates: number;
      debug?: DebugInfo;
    } = {
      bookedDates: Array.from(bookedDates).sort(),
      totalBookedDates: bookedDates.size,
    };

    if (debug) {
      response.debug = debugInfo;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Availability] Error fetching availability:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

