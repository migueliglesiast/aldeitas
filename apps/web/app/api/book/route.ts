import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchDynamicPricing } from "@/lib/airbnb";
import Stripe from "stripe";
import { hasLocalDateConflict } from "@/lib/booking-blocks";
import { checkExternalAvailability } from "@/lib/external-calendars";
import { getBookingMaxPendingMs } from "@/lib/booking-config";
import { getDefaultPaymentProvider } from "@/lib/payment-providers/config";
import { createProviderCheckout } from "@/lib/payment-providers";
import { AddonError, hotelChargedCents, priceAddonSelection } from "@/lib/addons";
import { recordBookingEvent } from "@/lib/booking-events";
import { findActiveOffer, offerAddonIds, offerDateKeys, offerPrice } from "@/lib/booking-offers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const bodySchema = z.object({
  listingId: z.string(),
  start: z.string(), // yyyy-MM-dd
  end: z.string(),
  email: z.string().email(),
  phone: z.string().min(6),
  offerToken: z.string().min(8).max(64).optional(),
  addons: z
    .array(
      z.object({
        addonId: z.string().min(1),
        quantity: z.number().int().min(0).max(50),
        option: z.string().max(40).optional(),
        from: z.string().max(10).optional(),
        to: z.string().max(10).optional(),
      })
    )
    .max(30)
    .optional(),
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
  const { email, phone, offerToken, addons: addonSelection = [] } = parsed.data;
  let { listingId, start, end } = parsed.data;

  const offer = offerToken ? await findActiveOffer(offerToken) : null;
  if (offerToken && !offer) return NextResponse.json({ error: "This booking link has expired" }, { status: 410 });
  if (offer) {
    listingId = offer.listingId;
    ({ start, end } = offerDateKeys(offer));
  }

  const paymentProvider = getDefaultPaymentProvider();
  if (!paymentProvider && !process.env.STRIPE_SECRET_KEY) return paymentUnavailable();

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

  const dynamic = offer ? null : await fetchDynamicPricing(listing.airbnbId, start, end);

  const nights = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const nightlyCents = offer?.nightlyCents ?? dynamic?.nightlyCents ?? listing.nightlyBasePrice;
  const currency = offer?.currency ?? dynamic?.currency ?? listing.baseCurrency;
  const staysCents = offer ? offerPrice(offer).totalCents : Math.round(nightlyCents * nights);

  let addons: Awaited<ReturnType<typeof priceAddonSelection>> = [];
  if (addonSelection.length > 0) {
    try {
      addons = await priceAddonSelection(
        { hotelId: listing.hotelId, listingId, currency, startDate, endDate, nights, nightlyCents },
        addonSelection,
        offer ? offerAddonIds(offer) ?? undefined : undefined
      );
    } catch (error) {
      if (error instanceof AddonError) return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
  }
  const totalCents = staysCents + hotelChargedCents(addons);

  const booking = await prisma.booking.create({
    data: {
      listingId,
      guestEmail: email,
      guestPhone: phone,
      ...(offer?.guestName ? { guestName: offer.guestName } : {}),
      startDate,
      endDate,
      totalPriceCents: totalCents,
      currency,
      status: "PENDING",
      paymentProvider: paymentProvider ?? "stripe",
      pendingExpiresAt: new Date(Date.now() + getBookingMaxPendingMs()),
      ...(addons.length > 0 ? { addons: { create: addons } } : {}),
    },
  });

  await recordBookingEvent(
    booking.id,
    "created",
    "ok",
    `${listing.title} · ${start} → ${end} · ${(totalCents / 100).toFixed(2)} ${currency}${offer ? " · private link" : ""}`
  );
  await recordBookingEvent(booking.id, "availability_initial", "ok", "Aldeitas and all external calendars free at checkout");

  const base = siteUrl(req);

  if (paymentProvider) {
    const checkout = await createProviderCheckout({
      provider: paymentProvider,
      bookingId: booking.id,
      amountCents: totalCents,
      currency,
      description: `${listing.title} (${start} → ${end})`,
      customerEmail: email,
      customerPhone: phone,
      successUrl: `${base}/booking/${booking.id}?provider=${paymentProvider}`,
      failureUrl: offer ? `${base}/offer/${offer.token}?canceled=1` : `${base}/listing/${listingId}?canceled=1`,
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: `${listing.title} (${start} → ${end})` },
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/listing/${listingId}?success=1`,
    cancel_url: `${base}/listing/${listingId}?canceled=1`,
    metadata: { bookingId: booking.id },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
