import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { hasBlockingLocalConflict } from "@/lib/booking-blocks";
import { hasManualBlockConflict } from "@/lib/manual-blocks";

export const dynamic = "force-dynamic";

const blockSchema = z.object({ ghostId: z.string() });

function blockNote(ghost: { guestName: string; guestCount: number | null }) {
  if (!ghost.guestCount) return ghost.guestName;
  return `${ghost.guestName} · ${ghost.guestCount} guest${ghost.guestCount === 1 ? "" : "s"}`;
}

/** Turns a ghost booking into a real manual block (dates become unavailable). */
export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = blockSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ghost = await prisma.ghostBooking.findFirst({
    where: { id: parsed.data.ghostId, hotelId: params.id },
  });
  if (!ghost) {
    return NextResponse.json({ error: "Ghost booking not found" }, { status: 404 });
  }

  if (await hasBlockingLocalConflict(ghost.listingId, ghost.startDate, ghost.endDate)) {
    return NextResponse.json({ error: "Dates already booked" }, { status: 409 });
  }
  if (await hasManualBlockConflict(ghost.listingId, ghost.startDate, ghost.endDate)) {
    return NextResponse.json({ error: "Dates already blocked" }, { status: 409 });
  }

  const [block] = await prisma.$transaction([
    prisma.manualBlock.create({
      data: {
        hotelId: ghost.hotelId,
        listingId: ghost.listingId,
        startDate: ghost.startDate,
        endDate: ghost.endDate,
        note: blockNote(ghost),
      },
    }),
    prisma.ghostBooking.delete({ where: { id: ghost.id } }),
  ]);

  return NextResponse.json(block);
}

export async function DELETE(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ghostId = req.nextUrl.searchParams.get("ghostId");
  if (!ghostId) {
    return NextResponse.json({ error: "ghostId required" }, { status: 400 });
  }

  const ghost = await prisma.ghostBooking.findFirst({
    where: { id: ghostId, hotelId: params.id },
  });
  if (!ghost) {
    return NextResponse.json({ error: "Ghost booking not found" }, { status: 404 });
  }

  await prisma.ghostBooking.delete({ where: { id: ghostId } });
  return NextResponse.json({ ok: true });
}
