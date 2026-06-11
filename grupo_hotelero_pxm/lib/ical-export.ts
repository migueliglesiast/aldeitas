import { prisma } from "@/lib/prisma";
import ical from "ical-generator";
import { blockingBookingStatusWhere } from "@/lib/booking-blocks";

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

  return new Response(cal.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${listingId}.ics"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
