import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchDynamicPricing } from "@/lib/airbnb";
import { hasLocalDateConflict } from "@/lib/booking-blocks";
import { checkExternalAvailability } from "@/lib/external-calendars";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import { getDefaultPaymentProvider } from "@/lib/payment-providers/config";
import { createProviderCheckout } from "@/lib/payment-providers";

const bodySchema = z.object({
  listingId: z.string(),
  start: z.string(), // yyyy-MM-dd
  end: z.string(),
  email: z.string().email(),
  phone: z.string().min(6),
});

function datesUnavailable() {
  return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });
}

function paymentUnavailable() {
  return NextResponse.json(
    { error: "Online payment is not available right now" },
    { status: 503 }
  );
}

function siteUrl(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
}

function unverifiableAvailability() {
  return NextResponse.json({ error: "Availability cannot be verified" }, { status: 503 });
}

export async function POST(req: NextRequest) {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_PHASE === 'phase-export') {
    return NextResponse.json({ error: 'Booking disabled in static export' }, { status: 405 });
  }
  try {
    return await handleBooking(req);
  } catch (error) {
    console.error("[Book] Error creating booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleBooking(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { listingId, start, end, email, phone } = parsed.data;

  const paymentProvider = getDefaultPaymentProvider();
  if (!paymentProvider) return paymentUnavailable();

  const listing = await prisma.listing.findUnique({ 
    where: { id: listingId },
    include: { calendarSources: true }
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (await hasLocalDateConflict(listingId, startDate, endDate)) return datesUnavailable();

  const external = await checkExternalAvailability(listing, startDate, endDate, "[Book]", "verify");
  if (external.status === "booked") return datesUnavailable();
  // Fail closed: an unverifiable calendar must not allow a double booking.
  if (external.status === "unverifiable") return unverifiableAvailability();

  // dynamic pricing attempt
  const dynamic = await fetchDynamicPricing(listing.airbnbId, start, end);

  const nights = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const nightlyCents = dynamic?.nightlyCents ?? listing.nightlyBasePrice;
  const currency = dynamic?.currency ?? listing.baseCurrency;
  const totalCents = Math.round(nightlyCents * nights);

  const booking = await prisma.booking.create({
    data: {
      listingId,
      guestEmail: email,
      guestPhone: phone,
      startDate,
      endDate,
      totalPriceCents: totalCents,
      currency,
      status: "PENDING",
      paymentProvider,
      pendingExpiresAt: new Date(Date.now() + getBookingMaxPendingMs()),
    },
  });

  const base = siteUrl(req);

  const checkout = await createProviderCheckout({
    provider: paymentProvider,
    bookingId: booking.id,
    amountCents: totalCents,
    currency,
    description: `${listing.title} (${start} → ${end})`,
    customerEmail: email,
    customerPhone: phone,
    successUrl: `${base}/booking/${booking.id}?provider=${paymentProvider}`,
    failureUrl: `${base}/listing/${listingId}?canceled=1`,
  });

  if (checkout.provider === "conekta") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentOrderId: checkout.orderId },
    });
    return NextResponse.json({ bookingId: booking.id, checkoutUrl: checkout.checkoutUrl });
  }

  return NextResponse.json({ bookingId: booking.id, paymentUrl: checkout.paymentPageUrl });
}
