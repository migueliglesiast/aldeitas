import { NextRequest, NextResponse } from "next/server";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { prisma } from "@/lib/prisma";
import { guestAnswerSchema } from "@/lib/whatsapp/guest-answer-schema";
import { roomCode, roomQrLink } from "@/lib/whatsapp/room-code";

export const dynamic = "force-dynamic";


type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [answers, listings] = await Promise.all([
    prisma.guestAnswer.findMany({ where: { hotelId: id }, orderBy: { createdAt: "asc" } }),
    prisma.listing.findMany({ where: { hotelId: id }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const business = process.env.WHATSAPP_BUSINESS_NUMBER;
  const rooms = listings.map((l) => ({
    id: l.id,
    title: l.title,
    code: roomCode(l.id),
    link: business ? roomQrLink(business, l.id, l.title) : null,
  }));
  return NextResponse.json({ answers, rooms });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = guestAnswerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.listingId) {
    const listing = await prisma.listing.findFirst({ where: { id: parsed.data.listingId, hotelId: id } });
    if (!listing) return NextResponse.json({ error: "Room not found" }, { status: 400 });
  }
  const answer = await prisma.guestAnswer.create({
    data: {
      hotelId: id,
      question: parsed.data.question,
      answer: parsed.data.answer,
      listingId: parsed.data.listingId ?? null,
      verifiedOnly: parsed.data.verifiedOnly ?? false,
    },
  });
  return NextResponse.json({ answer });
}
