import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockingBookingStatusWhere } from "@/lib/booking-blocks";
import { fetchListingExternalBlocks } from "@/lib/external-calendars";

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
  manualBlocks: number;
  legacyIcalUrl: string | null;
  fetchedDates: {
    fromLocalBookings: number;
    fromManualBlocks: number;
    fromLegacyIcal: number;
    fromCalendarSources: CalendarSourceDebug[];
  };
  errors: string[];
};

function addNights(
  bookedDates: Set<string>,
  startValue: Date | string,
  endValue: Date | string
) {
  let added = 0;
  const current = new Date(startValue);
  const end = new Date(endValue);
  while (current < end) {
    const dateStr = current.toISOString().split("T")[0];
    if (!bookedDates.has(dateStr)) {
      bookedDates.add(dateStr);
      added++;
    }
    current.setDate(current.getDate() + 1);
  }
  return added;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const debug =
      process.env.NODE_ENV !== "production" &&
      req.nextUrl.searchParams.get("debug") === "true";
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        calendarSources: true,
        bookings: {
          where: {
            ...blockingBookingStatusWhere,
          },
        },
        manualBlocks: true,
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
      manualBlocks: listing.manualBlocks.length,
      legacyIcalUrl: listing.icalUrl || null,
      fetchedDates: {
        fromLocalBookings: 0,
        fromManualBlocks: 0,
        fromLegacyIcal: 0,
        fromCalendarSources: [],
      },
      errors: [],
    };

    for (const booking of listing.bookings) {
      debugInfo.fetchedDates.fromLocalBookings += addNights(
        bookedDates,
        booking.startDate,
        booking.endDate
      );
    }

    for (const block of listing.manualBlocks) {
      debugInfo.fetchedDates.fromManualBlocks += addNights(
        bookedDates,
        block.startDate,
        block.endDate
      );
    }

    const external = await fetchListingExternalBlocks(listing, "[Availability]");
    for (const source of external.sources) {
      if (!source.ok) {
        debugInfo.errors.push(`Error fetching calendar "${source.name}": ${source.error}`);
        if (source.name !== "legacy") {
          debugInfo.fetchedDates.fromCalendarSources.push({
            name: source.name,
            url: source.icalUrl,
            error: source.error,
          });
        }
        continue;
      }

      let datesAdded = 0;
      for (const block of source.blocks) {
        datesAdded += addNights(bookedDates, block.start, block.end);
      }
      if (source.name === "legacy") {
        debugInfo.fetchedDates.fromLegacyIcal = datesAdded;
      } else {
        debugInfo.fetchedDates.fromCalendarSources.push({
          name: source.name,
          url: source.icalUrl,
          blocksFound: source.blocks.length,
          datesAdded,
        });
      }
    }

    if (!external.complete) {
      return NextResponse.json(
        {
          error: "Availability cannot be verified",
          ...(debug ? { debug: debugInfo } : {}),
        },
        { status: 503 }
      );
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
