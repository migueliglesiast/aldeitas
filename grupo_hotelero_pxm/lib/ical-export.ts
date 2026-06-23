import { prisma } from "@/lib/prisma";
import ical from "ical-generator";
import { blockingBookingStatusWhere } from "@/lib/booking-blocks";
import { getManualBlocksForListing } from "@/lib/manual-blocks";

export async function buildListingIcalResponse(listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return null;

  const bookings = await prisma.booking.findMany({
    where: {
      listingId,
      ...blockingBookingStatusWhere,
    },
    orderBy: { startDate: "asc" },
  });

  const manualBlocks = await getManualBlocksForListing(
    listingId,
    new Date(0),
    new Date("2099-12-31")
  );

  const cal = ical({ name: `${listing.title} – Casa Yahua` });
  for (const booking of bookings) {
    cal.createEvent({
      start: booking.startDate,
      end: booking.endDate,
      summary:
        booking.status === "CONFIRMED"
          ? `Reserved – ${listing.title}`
          : `Hold – ${listing.title}`,
      description: `Booking ${booking.id} – ${booking.guestEmail}`,
    });
  }

  for (const block of manualBlocks) {
    cal.createEvent({
      start: block.startDate,
      end: block.endDate,
      summary: `Blocked – ${listing.title}`,
      description: block.note || "Manual block",
    });
  }

  return new Response(cal.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${listingId}.ics"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
