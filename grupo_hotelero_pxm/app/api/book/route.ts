import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks, fetchDynamicPricing } from "@/lib/airbnb";
import Stripe from "stripe";
import { isBefore } from "date-fns";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const bodySchema = z.object({
  listingId: z.string(),
  start: z.string(), // yyyy-MM-dd
  end: z.string(),
  email: z.string().email(),
  phone: z.string().min(6),
});

export async function POST(req: NextRequest) {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_PHASE === 'phase-export') {
    return NextResponse.json({ error: 'Booking disabled in static export' }, { status: 405 });
  }
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { listingId, start, end, email, phone } = parsed.data;

  const listing = await prisma.listing.findUnique({ 
    where: { id: listingId },
    include: { calendarSources: true }
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // check availability via iCal blocks from all calendar sources
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  // Check legacy icalUrl if it exists
  if (listing.icalUrl) {
    const blocks = await fetchIcalBlocks(listing.icalUrl);
    const conflict = blocks.some((b) =>
      isBefore(startDate, b.end) && isBefore(b.start, endDate)
    );
    if (conflict) return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });
  }
  
  // Check all calendar sources linked to this listing
  for (const calendarSource of listing.calendarSources) {
    try {
      const blocks = await fetchIcalBlocks(calendarSource.icalUrl);
      const conflict = blocks.some((b) =>
        isBefore(startDate, b.end) && isBefore(b.start, endDate)
      );
      if (conflict) return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });
    } catch (error) {
      // Log error but continue checking other calendars
      console.error(`Error checking calendar ${calendarSource.name}:`, error);
    }
  }

  // check conflicts against local bookings (PENDING or CONFIRMED)
  const localConflicts = await prisma.booking.count({
    where: {
      listingId,
      status: { in: ["PENDING", "CONFIRMED"] },
      NOT: [
        { endDate: { lte: new Date(start) } },
        { startDate: { gte: new Date(end) } },
      ],
    },
  });
  if (localConflicts > 0) return NextResponse.json({ error: "Dates unavailable" }, { status: 409 });

  // dynamic pricing attempt
  const dynamic = await fetchDynamicPricing(listing.airbnbId, start, end);

  const nights = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const nightlyCents = dynamic?.nightlyCents ?? listing.nightlyBasePrice;
  const currency = dynamic?.currency ?? listing.baseCurrency;
  const totalCents = Math.round(nightlyCents * nights);

  // create internal booking record (pending)
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
    },
  });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      bookingId: booking.id,
      message: "Booking created (payment not configured)",
    });
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
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/listing/${listingId}?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/listing/${listingId}?canceled=1`,
    metadata: { bookingId: booking.id },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}


