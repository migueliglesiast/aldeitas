import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { parseDateKey } from "@/lib/calendar-dates";

export const dynamic = "force-dynamic";

const schema = z.object({
  listingId: z.string(),
  /** First night YYYY-MM-DD */
  startDate: z.string(),
  /** Exclusive checkout YYYY-MM-DD */
  endDate: z.string(),
  guestName: z.string().trim().min(1).max(120).nullable().optional(),
  guestCount: z.number().int().min(1).max(50).nullable().optional(),
  bookingId: z.string().optional(),
  sourceUid: z.string().optional(),
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
    return NextResponse.json({ error: "Invalid guest details" }, { status: 400 });
  }

  const listing = await prisma.listing.findFirst({
    where: { id: parsed.data.listingId, hotelId: params.id },
  });
  if (!listing) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const guestName =
    parsed.data.guestName === undefined
      ? undefined
      : parsed.data.guestName?.trim() || null;
  const guestCount =
    parsed.data.guestCount === undefined ? undefined : parsed.data.guestCount;

  // Direct bookings: update the Booking row.
  if (parsed.data.bookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: parsed.data.bookingId, listingId: listing.id },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        ...(guestName !== undefined ? { guestName } : {}),
        ...(guestCount !== undefined ? { guestCount } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      type: "booking",
      guestName: updated.guestName,
      guestCount: updated.guestCount,
    });
  }

  const startDate = parseDateKey(parsed.data.startDate);
  const endDate = parseDateKey(parsed.data.endDate);

  const meta = await prisma.calendarGuestMeta.upsert({
    where: {
      listingId_startDate_endDate: {
        listingId: listing.id,
        startDate,
        endDate,
      },
    },
    update: {
      ...(guestName !== undefined ? { guestName } : {}),
      ...(guestCount !== undefined ? { guestCount } : {}),
      ...(parsed.data.sourceUid ? { sourceUid: parsed.data.sourceUid } : {}),
    },
    create: {
      listingId: listing.id,
      startDate,
      endDate,
      guestName: guestName ?? null,
      guestCount: guestCount ?? null,
      sourceUid: parsed.data.sourceUid || null,
    },
  });

  return NextResponse.json({
    ok: true,
    type: "external",
    guestName: meta.guestName,
    guestCount: meta.guestCount,
  });
}
