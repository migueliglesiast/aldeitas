import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { adminCancelBooking } from "@/lib/admin-booking-cancel";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; bookingId: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { listing: true },
  });

  if (!booking || booking.listing.hotelId !== params.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const reason = parsed.success
    ? parsed.data.reason || "Canceled by hotel admin."
    : "Canceled by hotel admin.";

  try {
    const canceled = await adminCancelBooking(booking.id, reason);
    return NextResponse.json(canceled);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cancel failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
