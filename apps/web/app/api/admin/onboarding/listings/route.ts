import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractAirbnbListingId } from "@/lib/airbnb-listing-id";
import { getCurrentUser } from "@/lib/auth";
import { scanHotelGmailListings } from "@/lib/gmail-listing-discovery";
import { deleteUnbookedListing, importAirbnbListingIntoHotel } from "@/lib/import-airbnb-listing";
import { getOnboardingState, getPrimaryHotelId } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("import"),
    airbnbId: z.string().regex(/^\d{5,25}$/).optional(),
    url: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("review"),
    renames: z.array(z.object({ roomId: z.string().min(1), title: z.string().trim().min(1).max(80) })).max(50).default([]),
    merges: z.array(z.object({ unitId: z.string().min(1), intoRoomId: z.string().min(1) })).max(50).default([]),
    removals: z.array(z.string().min(1)).max(50).default([]),
  }),
]);

async function hotelForUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const hotelId = await getPrimaryHotelId(user.id);
  if (!hotelId) return { error: NextResponse.json({ error: "No hotel" }, { status: 404 }) };
  return { user, hotelId };
}

/** Scans the hotel's Gmail for the Airbnb listings its bookings came from. */
export async function GET() {
  const auth = await hotelForUser();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ listings: await scanHotelGmailListings(auth.hotelId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail search failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await hotelForUser();
  if (auth.error) return auth.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;

  if (body.action === "import") {
    const airbnbId = body.airbnbId ?? extractAirbnbListingId(body.url);
    if (!airbnbId) return NextResponse.json({ error: "not_airbnb" }, { status: 400 });
    try {
      return NextResponse.json({ airbnbId, ...(await importAirbnbListingIntoHotel(auth.hotelId, airbnbId)) });
    } catch (error) {
      console.error("[onboarding/listings] import", airbnbId, error);
      return NextResponse.json({ error: "unavailable", airbnbId }, { status: 422 });
    }
  }

  const rooms = await prisma.listing.findMany({
    where: { hotelId: auth.hotelId },
    select: { id: true, icalUrl: true },
  });
  const inHotel = new Map(rooms.map((room) => [room.id, room]));
  const removed = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const merge of body.merges) {
      const unit = inHotel.get(merge.unitId);
      const into = inHotel.get(merge.intoRoomId);
      if (!unit || !into || unit.id === into.id || removed.has(unit.id) || removed.has(into.id)) continue;
      const unitRow = await tx.listing.findUniqueOrThrow({ where: { id: unit.id }, select: { title: true } });
      await tx.calendarSource.updateMany({ where: { listingId: unit.id }, data: { listingId: into.id } });
      if (await deleteUnbookedListing(tx, unit.id)) {
        removed.add(unit.id);
        await tx.listing.update({
          where: { id: into.id },
          data: { title: unitRow.title, ...(into.icalUrl || !unit.icalUrl ? {} : { icalUrl: unit.icalUrl }) },
        });
      }
    }
    for (const roomId of body.removals) {
      if (inHotel.has(roomId) && !removed.has(roomId) && (await deleteUnbookedListing(tx, roomId))) {
        removed.add(roomId);
      }
    }
    for (const rename of body.renames) {
      if (inHotel.has(rename.roomId) && !removed.has(rename.roomId)) {
        await tx.listing.update({ where: { id: rename.roomId }, data: { title: rename.title } });
      }
    }
  });

  return NextResponse.json(await getOnboardingState(auth.user.id));
}
