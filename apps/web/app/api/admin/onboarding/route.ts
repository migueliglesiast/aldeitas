import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";
import {
  getOnboardingState,
  getPrimaryHotelId,
  resolveMapsCoordinates,
} from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
});

const saveSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("you"),
    nickname: z.string().trim().min(1),
    phoneNumber: z.string().trim().min(8),
  }),
  z.object({
    step: z.literal("story"),
    description: z.string().trim().min(20).max(500),
  }),
  z.object({
    step: z.literal("map"),
    location: z.string().trim().min(2).max(120),
    maps: z.string().trim().min(3).max(2000),
  }),
  z.object({
    step: z.literal("team"),
    cleaner: contactSchema,
    maintenance: contactSchema.optional(),
  }),
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getOnboardingState(user.id));
}

async function upsertContact(hotelId: string, type: string, contact: { name: string; phone: string }) {
  const existing = await prisma.hotelContact.findFirst({
    where: { hotelId, type },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.hotelContact.update({ where: { id: existing.id }, data: contact });
  } else {
    await prisma.hotelContact.create({ data: { hotelId, type, ...contact } });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.step === "you") {
    await prisma.user.update({
      where: { id: user.id },
      data: { nickname: body.nickname, phoneNumber: body.phoneNumber },
    });
    return NextResponse.json(await getOnboardingState(user.id));
  }

  const hotelId = await getPrimaryHotelId(user.id);
  if (!hotelId) {
    return NextResponse.json({ error: "no_hotel" }, { status: 404 });
  }

  if (body.step === "story") {
    const bilingual = await syncBilingualDescription(body.description);
    await prisma.hotel.update({
      where: { id: hotelId },
      data: {
        description: bilingual.description,
        descriptionEn: bilingual.descriptionEn,
        descriptionEs: bilingual.descriptionEs,
      },
    });
  }

  if (body.step === "map") {
    const coords = await resolveMapsCoordinates(body.maps).catch(() => null);
    if (!coords) {
      return NextResponse.json({ error: "map_not_found" }, { status: 422 });
    }
    await prisma.hotel.update({
      where: { id: hotelId },
      data: {
        location: body.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        ...(body.maps.startsWith("https://") ? { googleMapsUrl: body.maps } : {}),
      },
    });
  }

  if (body.step === "team") {
    await upsertContact(hotelId, "CLEANER", body.cleaner);
    if (body.maintenance) {
      await upsertContact(hotelId, "MAIN_MAINTENANCE", body.maintenance);
    }
  }

  return NextResponse.json(await getOnboardingState(user.id));
}
