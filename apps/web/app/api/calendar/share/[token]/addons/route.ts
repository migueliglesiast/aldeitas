import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHotelIdForShareToken } from "@/lib/hotel-calendar-data";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  addonId: z.string().min(1).max(64),
  delivered: z.boolean(),
});

/** Cleaners tick off guest extras (beer, fruit, vehicle…) from the shared calendar. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const hotelId = await getHotelIdForShareToken(token);
  if (!hotelId) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const addon = await prisma.bookingAddon.findFirst({
    where: { id: parsed.data.addonId, booking: { listing: { hotelId } } },
    select: { id: true },
  });
  if (!addon) {
    return NextResponse.json({ error: "Extra not found" }, { status: 404 });
  }

  const updated = await prisma.bookingAddon.update({
    where: { id: addon.id },
    data: { deliveredAt: parsed.data.delivered ? new Date() : null },
    select: { id: true, deliveredAt: true },
  });
  return NextResponse.json({ id: updated.id, delivered: updated.deliveredAt != null });
}
