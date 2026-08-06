import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import ical from "ical-generator";

export async function GET(_req: NextRequest, { params }: { params: { listingId: string } }) {
  const { listingId } = params;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return new Response("Not found", { status: 404 });

  const bookings = await prisma.booking.findMany({
    where: { listingId, status: "CONFIRMED" },
  });

  const cal = ical({ name: `${listing.title} – Casa Yahua` });
  for (const b of bookings) {
    cal.createEvent({
      start: b.startDate,
      end: b.endDate,
      summary: `Reserved – ${listing.title}`,
      description: `Booking ${b.id} – ${b.guestEmail}`,
    });
  }

  return new Response(cal.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=listing-${listingId}.ics` ,
    },
  });
}

export async function generateStaticParams() {
  // Pre-generate ICS files for all listings during static export.
  // The database may be unavailable at build time; the route still works at runtime.
  try {
    const ids = await prisma.listing.findMany({ select: { id: true } });
    return ids.map(({ id }) => ({ listingId: id }));
  } catch {
    return [];
  }
}

export const dynamic = "force-static";


