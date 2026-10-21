import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, hotelId: true, hotel: { select: { name: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      addons: { select: { name: true, quantity: true, option: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const auth = await requireHotelManager(booking.listing.hotelId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      guestEmail: booking.guestEmail,
      guestName: booking.guestName,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      totalPriceCents: booking.totalPriceCents,
      currency: booking.currency,
      paymentProvider: booking.paymentProvider,
      paymentOrderId: booking.paymentOrderId,
      createdAt: booking.createdAt.toISOString(),
      authorizedAt: booking.authorizedAt?.toISOString() ?? null,
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      pendingExpiresAt: booking.pendingExpiresAt?.toISOString() ?? null,
      lastReconciledAt: booking.lastReconciledAt?.toISOString() ?? null,
      cancelReason: booking.cancelReason,
      listing: { id: booking.listing.id, title: booking.listing.title, hotelName: booking.listing.hotel.name },
      addons: booking.addons,
    },
    events: booking.events.map((event) => ({
      step: event.step,
      status: event.status,
      detail: event.detail,
      createdAt: event.createdAt.toISOString(),
    })),
    serverTime: new Date().toISOString(),
  });
}
