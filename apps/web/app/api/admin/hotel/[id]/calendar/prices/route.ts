import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { parseDateKey } from "@/lib/calendar-dates";

export const dynamic = "force-dynamic";

const schema = z.object({
  listingId: z.string(),
  nightlyBasePrice: z.number().int().min(0).optional(),
  date: z.string().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid price data" }, { status: 400 });
  }

  const listing = await prisma.listing.findFirst({
    where: { id: parsed.data.listingId, hotelId: params.id },
  });
  if (!listing) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (parsed.data.nightlyBasePrice !== undefined) {
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { nightlyBasePrice: parsed.data.nightlyBasePrice },
    });
    return NextResponse.json(updated);
  }

  if (!parsed.data.date) {
    return NextResponse.json({ error: "date required for daily price" }, { status: 400 });
  }

  const date = parseDateKey(parsed.data.date);

  if (parsed.data.priceCents == null) {
    await prisma.listingDailyPrice.deleteMany({
      where: { listingId: listing.id, date },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const daily = await prisma.listingDailyPrice.upsert({
    where: {
      listingId_date: {
        listingId: listing.id,
        date,
      },
    },
    update: {
      priceCents: parsed.data.priceCents,
      currency: listing.baseCurrency,
    },
    create: {
      listingId: listing.id,
      date,
      priceCents: parsed.data.priceCents,
      currency: listing.baseCurrency,
    },
  });

  return NextResponse.json(daily);
}
