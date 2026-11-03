import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";
import { MAX_CONTACT_PRIORITY } from "@/lib/contact-priority";
import { isValidClabe, normalizeClabe } from "@/lib/clabe";
import { isValidRfc, normalizeRfc } from "@/lib/rfc";
import {
  getOnboardingState,
  getPrimaryHotelId,
  resolveMapsCoordinates,
} from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  priority: z.number().int().min(1).max(MAX_CONTACT_PRIORITY).optional(),
});

const saveSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("you"),
    nickname: z.string().trim().min(1).optional(),
    phoneNumber: z.string().trim().min(8).optional(),
    owner: contactSchema.optional(),
    managers: z.array(contactSchema).max(MAX_CONTACT_PRIORITY - 1).optional(),
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
  z.object({
    step: z.literal("payouts"),
    clabe: z.string().transform(normalizeClabe).refine(isValidClabe, { message: "clabe_invalid" }),
    holder: z.string().trim().min(2).max(120),
    rfc: z
      .string()
      .transform(normalizeRfc)
      .refine((v) => v === "" || isValidRfc(v), { message: "rfc_invalid" })
      .optional(),
  }),
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getOnboardingState(user.id));
}

type ContactInput = z.infer<typeof contactSchema>;

function contactData({ priority, ...contact }: ContactInput) {
  return { ...contact, ...(priority ? { priority: String(priority) } : {}) };
}

async function upsertContact(hotelId: string, type: string, contact: ContactInput) {
  const existing = await prisma.hotelContact.findFirst({
    where: { hotelId, type },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const data = contactData(contact);
  if (existing) {
    await prisma.hotelContact.update({ where: { id: existing.id }, data });
  } else {
    await prisma.hotelContact.create({ data: { hotelId, type, ...data } });
  }
}

/** Makes the hotel's contacts of `type` exactly `contacts`, reusing existing rows in order. */
async function replaceContacts(hotelId: string, type: string, contacts: ContactInput[]) {
  const existing = await prisma.hotelContact.findMany({
    where: { hotelId, type },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const [i, contact] of contacts.entries()) {
    const data = contactData(contact);
    if (existing[i]) {
      await prisma.hotelContact.update({ where: { id: existing[i].id }, data });
    } else {
      await prisma.hotelContact.create({ data: { hotelId, type, ...data } });
    }
  }
  const stale = existing.slice(contacts.length).map((c) => c.id);
  if (stale.length) {
    await prisma.hotelContact.deleteMany({ where: { id: { in: stale } } });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const known = parsed.error.issues.find((issue) => issue.message === "clabe_invalid" || issue.message === "rfc_invalid");
    return NextResponse.json({ error: known?.message ?? "invalid" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.step === "you" && !body.owner) {
    if (!body.nickname || !body.phoneNumber) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
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

  if (body.step === "you" && body.owner) {
    await upsertContact(hotelId, "OWNER", body.owner);
    if (body.managers) {
      await replaceContacts(hotelId, "MANAGER", body.managers);
    }
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

  if (body.step === "payouts") {
    await prisma.hotel.update({
      where: { id: hotelId },
      data: { payoutClabe: body.clabe, payoutAccountHolder: body.holder, payoutRfc: body.rfc || null },
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
