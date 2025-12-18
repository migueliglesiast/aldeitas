import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";
import { isBefore } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const { checkIn, checkOut } = await req.json();
    
    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: "checkIn and checkOut dates are required" }, { status: 400 });
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);

    // Get all hotels with their listings and calendar sources
    const hotels = await prisma.hotel.findMany({
      include: {
        listings: {
          include: {
            calendarSources: true,
            bookings: {
              where: {
                status: { in: ["PENDING", "CONFIRMED"] },
                NOT: [
                  { endDate: { lte: startDate } },
                  { startDate: { gte: endDate } },
                ],
              },
            },
          },
        },
      },
    });

    // Check availability for each listing
    const hotelAvailability = await Promise.all(
      hotels.map(async (hotel) => {
        const availableListings = await Promise.all(
          hotel.listings.map(async (listing) => {
            // Check if listing has any calendar sources (iCal URLs)
            const hasCalendarSources = listing.calendarSources.length > 0 || listing.icalUrl;
            
            if (!hasCalendarSources) {
              // If no calendar sources, listing is not available
              return null;
            }

            // Check local bookings first (fastest check)
            if (listing.bookings.length > 0) {
              return null; // Has conflicts
            }

            // Check legacy icalUrl if it exists
            if (listing.icalUrl) {
              try {
                const blocks = await fetchIcalBlocks(listing.icalUrl);
                const conflict = blocks.some((b) =>
                  isBefore(startDate, b.end) && isBefore(b.start, endDate)
                );
                if (conflict) return null;
              } catch (error) {
                // If we can't fetch the calendar, assume unavailable
                console.error(`Error checking calendar for listing ${listing.id}:`, error);
                return null;
              }
            }

            // Check all calendar sources linked to this listing
            for (const calendarSource of listing.calendarSources) {
              try {
                const blocks = await fetchIcalBlocks(calendarSource.icalUrl);
                const conflict = blocks.some((b) =>
                  isBefore(startDate, b.end) && isBefore(b.start, endDate)
                );
                if (conflict) return null;
              } catch (error) {
                // If we can't fetch the calendar, assume unavailable
                console.error(`Error checking calendar ${calendarSource.name}:`, error);
                return null;
              }
            }

            // If we get here, the listing is available
            return listing.id;
          })
        );

        const availableListingIds = availableListings.filter((id): id is string => id !== null);
        
        return {
          hotelId: hotel.id,
          availableRoomCount: availableListingIds.length,
        };
      })
    );

    // Return a map of hotelId -> availableRoomCount
    // Only include hotels with at least one available room
    const availabilityMap: Record<string, number> = {};
    hotelAvailability.forEach(({ hotelId, availableRoomCount }) => {
      if (availableRoomCount > 0) {
        availabilityMap[hotelId] = availableRoomCount;
      }
    });

    return NextResponse.json(availabilityMap);
  } catch (error: any) {
    console.error("Error checking availability:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

