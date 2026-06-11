import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks, fetchDynamicPricing } from "@/lib/airbnb";
import { isBefore } from "date-fns";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import {
  createProviderCheckout,
} from "@/lib/payment-providers";
import {
  getDefaultPaymentProvider,
  isPaymentProviderConfigured,
} from "@/lib/payment-providers/config";
import type { PaymentProviderId } from "@/lib/payment-providers/types";
import {
  expireStaleUnpaidBookings,
  hasBlockingLocalConflict,
} from "@/lib/booking-blocks";
import { SITE_CURRENCY } from "@/lib/currency";

const bodySchema = z.object({
  listingId: z.string(),
  start: z.string(),
  end: z.string(),
  email: z.string().email(),
  phone: z.string().min(6),
  paymentProvider: z.enum(["conekta", "mercadopago"]).optional(),
});

export async function POST(req: NextRequest) {
  if (process.env.NEXT_RUNTIME === "edge" || process.env.NEXT_PHASE === "phase-export") {
    return NextResponse.json({ error: "Booking disabled in static export" }, { status: 405 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { listingId, start, end, email, phone } = parsed.data;
  const paymentProvider =
    parsed.data.paymentProvider && isPaymentProviderConfigured(parsed.data.paymentProvider)
      ? parsed.data.paymentProvider
      : getDefaultPaymentProvider();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { calendarSources: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  await expireStaleUnpaidBookings(listingId);

  if (listing.icalUrl) {
    const blocks = await fetchIcalBlocks(listing.icalUrl);
    const conflict = blocks.some(
      (b) => isBefore(startDate, b.end) && isBefore(b.start, endDate)
    );
    if (conflict) {
      return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });
    }
  }

  for (const calendarSource of listing.calendarSources) {
    try {
      const blocks = await fetchIcalBlocks(calendarSource.icalUrl);
      const conflict = blocks.some(
        (b) => isBefore(startDate, b.end) && isBefore(b.start, endDate)
      );
      if (conflict) {
        return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });
      }
    } catch (error) {
      console.error(`Error checking calendar ${calendarSource.name}:`, error);
    }
  }

  if (await hasBlockingLocalConflict(listingId, startDate, endDate)) {
    return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });
  }

  const dynamic = await fetchDynamicPricing(listing.airbnbId, start, end);
  const nights = Math.max(
    0,
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (nights <= 0) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const currency = SITE_CURRENCY;
  const nightlyCents =
    dynamic?.currency === SITE_CURRENCY
      ? dynamic.nightlyCents
      : listing.nightlyBasePrice;
  const totalCents = Math.round(nightlyCents * nights);

  const booking = await prisma.booking.create({
    data: {
      listingId,
      guestEmail: email,
      guestPhone: phone,
      startDate: new Date(start),
      endDate: new Date(end),
      totalPriceCents: totalCents,
      currency,
      status: "PENDING",
      pendingExpiresAt: new Date(Date.now() + getBookingMaxPendingMs()),
    },
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const statusUrl = `${siteUrl}/booking/${booking.id}`;

  if (!paymentProvider) {
    return NextResponse.json({
      bookingId: booking.id,
      statusUrl,
      message:
        "Booking saved, but Mercado Pago is not configured. Add MERCADOPAGO_ACCESS_TOKEN and NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY to .env. See BOOKING_SETUP.md.",
    });
  }

  const checkout = await createProviderCheckout({
    provider: paymentProvider as PaymentProviderId,
    bookingId: booking.id,
    amountCents: totalCents,
    currency,
    description: `${listing.title} (${start} → ${end})`,
    customerEmail: email,
    customerPhone: phone,
    successUrl: `${siteUrl}/booking/${booking.id}?provider=conekta`,
    failureUrl: `${siteUrl}/listing/${listingId}?canceled=1`,
  });

  if (checkout.provider === "conekta") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentProvider: "conekta",
        paymentOrderId: checkout.orderId,
      },
    });

    return NextResponse.json({
      bookingId: booking.id,
      checkoutUrl: checkout.checkoutUrl,
      statusUrl: `${siteUrl}/booking/${booking.id}?provider=conekta`,
      paymentProvider: "conekta",
    });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentProvider: "mercadopago",
    },
  });

  return NextResponse.json({
    bookingId: booking.id,
    paymentPageUrl: checkout.paymentPageUrl,
    statusUrl,
    paymentProvider: "mercadopago",
  });
}
