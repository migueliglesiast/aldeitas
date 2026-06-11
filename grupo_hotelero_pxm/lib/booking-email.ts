import nodemailer from "nodemailer";
import type { Booking, Listing } from "@prisma/client";
import { formatMoney } from "@/lib/currency";

type BookingWithListing = Booking & { listing: Listing };

function getTransport() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function formatDateRange(booking: Booking) {
  return `${booking.startDate.toDateString()} to ${booking.endDate.toDateString()}`;
}

function formatTotal(booking: Booking) {
  return formatMoney(booking.totalPriceCents, booking.currency);
}

function bookingStatusUrl(bookingId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${baseUrl}/booking/${bookingId}`;
}

async function sendMail(to: string, subject: string, text: string) {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!transport || !from) {
    console.log(`[booking-email] ${subject}\nTo: ${to}\n${text}`);
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
  });
}

export async function sendBookingProcessingEmail(booking: BookingWithListing) {
  await sendMail(
    booking.guestEmail,
    `We received your booking request: ${booking.listing.title}`,
    [
      `Thanks for booking ${booking.listing.title}.`,
      "",
      `Dates: ${formatDateRange(booking)}`,
      `Estimated total: ${formatTotal(booking)}`,
      "",
      "Your card has been authorized, but you have not been charged yet.",
      "We are securing your dates across booking channels. This can take up to 2 hours.",
      "",
      `Track your booking here: ${bookingStatusUrl(booking.id)}`,
      "",
      "You will receive another email once your booking is confirmed or if the dates are no longer available.",
    ].join("\n")
  );
}

export async function sendBookingConfirmedEmail(booking: BookingWithListing) {
  await sendMail(
    booking.guestEmail,
    `Booking confirmed: ${booking.listing.title}`,
    [
      `Your booking is confirmed for ${booking.listing.title}.`,
      "",
      `Dates: ${formatDateRange(booking)}`,
      `Total charged: ${formatTotal(booking)}`,
      "",
      `Booking reference: ${booking.id}`,
      `Status page: ${bookingStatusUrl(booking.id)}`,
    ].join("\n")
  );
}

export async function sendBookingCanceledEmail(
  booking: BookingWithListing,
  reason: string
) {
  await sendMail(
    booking.guestEmail,
    `Update on your booking request: ${booking.listing.title}`,
    [
      `We could not confirm your booking for ${booking.listing.title}.`,
      "",
      `Dates requested: ${formatDateRange(booking)}`,
      "",
      reason,
      "",
      "Your card was not charged. Any temporary authorization should disappear according to your bank's timeline.",
      "",
      `Booking reference: ${booking.id}`,
    ].join("\n")
  );
}
