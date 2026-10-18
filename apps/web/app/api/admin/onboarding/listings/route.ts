import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { discoverHotelAirbnbListings } from "@/lib/gmail-listing-discovery";
import { fillListingFromAirbnb } from "@/lib/import-airbnb-listing";
import { getOnboardingState, getPrimaryHotelId } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const linkSchema = z.object({
  links: z
    .array(
      z.object({
        airbnbId: z.string().regex(/^\d{5,25}$/),
        roomId: z.string().min(1).nullable(),
        title: z.string().trim().max(120).optional(),
      })
    )
    .min(1)
    .max(30),
});

async function hotelForUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const hotelId = await getPrimaryHotelId(user.id);
  if (!hotelId) return { error: NextResponse.json({ error: "No hotel" }, { status: 404 }) };
  return { user, hotelId };
}

export async function GET() {
  const auth = await hotelForUser();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ listings: await discoverHotelAirbnbListings(auth.hotelId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail search failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await hotelForUser();
  if (auth.error) return auth.error;
  const parsed = linkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const rooms = await prisma.listing.findMany({
    where: { hotelId: auth.hotelId },
    select: { id: true },
  });
  const roomIds = new Set(rooms.map((room) => room.id));
  const results: Array<{ airbnbId: string; roomId: string | null; ok: boolean; photoCount: number }> = [];

  for (const link of parsed.data.links) {
    if (link.roomId && !roomIds.has(link.roomId)) {
      results.push({ airbnbId: link.airbnbId, roomId: link.roomId, ok: false, photoCount: 0 });
      continue;
    }
    let roomId = link.roomId;
    try {
      if (!roomId) {
        const created = await prisma.listing.create({
          data: {
            hotelId: auth.hotelId,
            airbnbId: link.airbnbId,
            airbnbUrl: `https://www.airbnb.com/rooms/${link.airbnbId}`,
            title: link.title || `Airbnb ${link.airbnbId}`,
          },
          select: { id: true },
        });
        roomId = created.id;
        roomIds.add(roomId);
      }
      const filled = await fillListingFromAirbnb(roomId, link.airbnbId);
      results.push({ airbnbId: link.airbnbId, roomId, ok: true, photoCount: filled.photoCount });
    } catch (error) {
      console.error("[onboarding/listings]", link.airbnbId, error);
      results.push({ airbnbId: link.airbnbId, roomId, ok: false, photoCount: 0 });
    }
  }

  return NextResponse.json({ results, state: await getOnboardingState(auth.user.id) });
}
