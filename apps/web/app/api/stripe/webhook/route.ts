import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try {
    if (!secret) throw new Error("Webhook secret missing");
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      const booking = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CONFIRMED", stripePaymentIntentId: session.payment_intent?.toString() },
        include: { listing: true },
      });

      // send confirmation email
      if (process.env.SMTP_HOST) {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transport.sendMail({
          from: process.env.EMAIL_FROM,
          to: booking.guestEmail,
          subject: `Booking confirmed: ${booking.listing.title}`,
          text: `Your booking is confirmed from ${booking.startDate.toDateString()} to ${booking.endDate.toDateString()}. Total ${(booking.totalPriceCents / 100).toFixed(2)} ${booking.currency}.`,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}


