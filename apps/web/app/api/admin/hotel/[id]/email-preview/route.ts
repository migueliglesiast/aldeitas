import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { loadEmailBrand } from "@/lib/email/hotel-brand";
import {
  buildAdminBookingProcessingEmail,
  buildBookingCanceledEmail,
  buildBookingConfirmedEmail,
  buildBookingProcessingEmail,
} from "@/lib/email/templates/booking";

export const dynamic = "force-dynamic";

/** Renders a booking email for one of this hotel's bookings, for managers to preview. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  const booking = await prisma.booking.findFirst({
    where: bookingId ? { id: bookingId, listing: { hotelId: id } } : { listing: { hotelId: id } },
    orderBy: { createdAt: "desc" },
    include: { listing: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const brand = await loadEmailBrand(booking.listingId);
  const type = req.nextUrl.searchParams.get("type");
  const message =
    type === "confirmed"
      ? buildBookingConfirmedEmail(booking, brand)
      : type === "canceled"
        ? buildBookingCanceledEmail(booking, "Las fechas ya no estaban disponibles.", brand)
        : type === "admin"
          ? buildAdminBookingProcessingEmail(booking, brand)
          : buildBookingProcessingEmail(booking, brand);

  return new NextResponse(message.html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
