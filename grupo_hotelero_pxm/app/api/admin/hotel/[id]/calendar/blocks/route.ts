import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { parseDateKey } from "@/lib/calendar-dates";
import { hasBlockingLocalConflict } from "@/lib/booking-blocks";
import { hasManualBlockConflict } from "@/lib/manual-blocks";

export const dynamic = "force-dynamic";

const schema = z.object({
  listingId: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid block data" }, { status: 400 });
  }

  const listing = await prisma.listing.findFirst({
    where: { id: parsed.data.listingId, hotelId: params.id },
  });
  if (!listing) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const startDate = parseDateKey(parsed.data.startDate);
  const endDate = parsed.data.endDate
    ? parseDateKey(parsed.data.endDate)
    : (() => {
        const next = new Date(startDate);
        next.setDate(next.getDate() + 1);
        return next;
      })();

  if (endDate <= startDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  if (await hasBlockingLocalConflict(listing.id, startDate, endDate)) {
    return NextResponse.json({ error: "Dates already booked" }, { status: 409 });
  }

  if (await hasManualBlockConflict(listing.id, startDate, endDate)) {
    return NextResponse.json({ error: "Dates already blocked" }, { status: 409 });
  }

  const block = await prisma.manualBlock.create({
    data: {
      hotelId: params.id,
      listingId: listing.id,
      startDate,
      endDate,
      note: parsed.data.note,
    },
  });

  return NextResponse.json(block);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const blockId = req.nextUrl.searchParams.get("blockId");
  if (!blockId) {
    return NextResponse.json({ error: "blockId required" }, { status: 400 });
  }

  const block = await prisma.manualBlock.findFirst({
    where: { id: blockId, hotelId: params.id },
  });
  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  await prisma.manualBlock.delete({ where: { id: blockId } });
  return NextResponse.json({ ok: true });
}
