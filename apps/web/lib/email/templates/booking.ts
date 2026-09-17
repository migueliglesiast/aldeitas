import { format } from "date-fns";
import type { Booking, Listing } from "@prisma/client";
import { formatMoney } from "@/lib/currency";
import { getSiteUrl } from "@/lib/email/config";
import {
  renderDetailsTable,
  renderEmailLayout,
  renderParagraph,
} from "@/lib/email/templates/layout";

export type BookingWithListing = Booking & { listing: Listing };

function formatDateRange(booking: Booking) {
  return `${format(booking.startDate, "MMM d, yyyy")} – ${format(booking.endDate, "MMM d, yyyy")}`;
}

function formatTotal(booking: Booking) {
  return formatMoney(booking.totalPriceCents, booking.currency);
}

function bookingStatusUrl(bookingId: string) {
  return `${getSiteUrl()}/booking/${bookingId}`;
}

function bookingDetailsRows(booking: BookingWithListing) {
  return [
    { label: "Property", value: booking.listing.title },
    { label: "Dates", value: formatDateRange(booking) },
    { label: "Total", value: formatTotal(booking) },
    { label: "Reference", value: booking.id },
    { label: "Guest email", value: booking.guestEmail },
    { label: "Guest phone", value: booking.guestPhone },
  ];
}

export function buildBookingProcessingEmail(booking: BookingWithListing) {
  const statusUrl = bookingStatusUrl(booking.id);
  const subject = `We received your booking request: ${booking.listing.title}`;
  const text = [
    `Thanks for booking ${booking.listing.title}.`,
    "",
    `Dates: ${formatDateRange(booking)}`,
    `Estimated total: ${formatTotal(booking)}`,
    "",
    "Your card has been authorized, but you have not been charged yet.",
    "We are securing your dates across booking channels. This can take up to 2 hours.",
    "",
    `Track your booking: ${statusUrl}`,
    "",
    "You will receive another email once your booking is confirmed or if the dates are no longer available.",
  ].join("\n");

  const html = renderEmailLayout({
    title: subject,
    preheader: "Your payment is authorized. We are confirming your dates.",
    bodyHtml: [
      renderParagraph(`Thanks for booking ${booking.listing.title}.`),
      renderParagraph(
        "Your card has been authorized, but you have not been charged yet. We are securing your dates across booking channels. This can take up to 2 hours."
      ),
      renderDetailsTable(bookingDetailsRows(booking)),
    ].join(""),
    ctaLabel: "View booking status",
    ctaUrl: statusUrl,
  });

  return { subject, text, html };
}

export function buildBookingConfirmedEmail(booking: BookingWithListing) {
  const statusUrl = bookingStatusUrl(booking.id);
  const subject = `Booking confirmed: ${booking.listing.title}`;
  const text = [
    `Your booking is confirmed for ${booking.listing.title}.`,
    "",
    `Dates: ${formatDateRange(booking)}`,
    `Total charged: ${formatTotal(booking)}`,
    "",
    `Booking reference: ${booking.id}`,
    `Status page: ${statusUrl}`,
  ].join("\n");

  const html = renderEmailLayout({
    title: subject,
    preheader: "Your stay is confirmed.",
    bodyHtml: [
      renderParagraph(`Your booking is confirmed for ${booking.listing.title}.`),
      renderParagraph("Your card has been charged. We look forward to hosting you."),
      renderDetailsTable(bookingDetailsRows(booking)),
    ].join(""),
    ctaLabel: "View booking details",
    ctaUrl: statusUrl,
  });

  return { subject, text, html };
}

export function buildBookingCanceledEmail(booking: BookingWithListing, reason: string) {
  const subject = `Update on your booking request: ${booking.listing.title}`;
  const text = [
    `We could not confirm your booking for ${booking.listing.title}.`,
    "",
    `Dates requested: ${formatDateRange(booking)}`,
    "",
    reason,
    "",
    "Your card was not charged. Any temporary authorization should disappear according to your bank's timeline.",
    "",
    `Booking reference: ${booking.id}`,
  ].join("\n");

  const html = renderEmailLayout({
    title: subject,
    preheader: "Your booking request could not be confirmed.",
    bodyHtml: [
      renderParagraph(`We could not confirm your booking for ${booking.listing.title}.`),
      renderParagraph(reason),
      renderParagraph(
        "Your card was not charged. Any temporary authorization should disappear according to your bank's timeline."
      ),
      renderDetailsTable([
        { label: "Property", value: booking.listing.title },
        { label: "Dates requested", value: formatDateRange(booking) },
        { label: "Reference", value: booking.id },
      ]),
    ].join(""),
  });

  return { subject, text, html };
}

export function buildAdminBookingProcessingEmail(booking: BookingWithListing) {
  const statusUrl = bookingStatusUrl(booking.id);
  const subject = `New booking request: ${booking.listing.title}`;
  const text = [
    "A guest completed payment authorization and the booking is processing.",
    "",
    `Property: ${booking.listing.title}`,
    `Guest: ${booking.guestEmail} (${booking.guestPhone})`,
    `Dates: ${formatDateRange(booking)}`,
    `Total: ${formatTotal(booking)}`,
    `Reference: ${booking.id}`,
    "",
    `Admin status page: ${statusUrl}`,
  ].join("\n");

  const html = renderEmailLayout({
    title: subject,
    preheader: "A new direct booking is processing.",
    bodyHtml: [
      renderParagraph("A guest completed payment authorization and the booking is processing."),
      renderDetailsTable(bookingDetailsRows(booking)),
    ].join(""),
    ctaLabel: "Open booking",
    ctaUrl: statusUrl,
  });

  return { subject, text, html };
}

export function buildAdminBookingConfirmedEmail(booking: BookingWithListing) {
  const subject = `Booking confirmed: ${booking.listing.title}`;
  const text = [
    "A direct booking was confirmed and captured.",
    "",
    `Property: ${booking.listing.title}`,
    `Guest: ${booking.guestEmail}`,
    `Dates: ${formatDateRange(booking)}`,
    `Total: ${formatTotal(booking)}`,
    `Reference: ${booking.id}`,
  ].join("\n");

  const html = renderEmailLayout({
    title: subject,
    preheader: "A direct booking was confirmed.",
    bodyHtml: [
      renderParagraph("A direct booking was confirmed and the payment was captured."),
      renderDetailsTable(bookingDetailsRows(booking)),
    ].join(""),
  });

  return { subject, text, html };
}

export function buildAdminBookingCanceledEmail(booking: BookingWithListing, reason: string) {
  const subject = `Booking canceled: ${booking.listing.title}`;
  const text = [
    "A direct booking was canceled before capture.",
    "",
    `Property: ${booking.listing.title}`,
    `Guest: ${booking.guestEmail}`,
    `Dates: ${formatDateRange(booking)}`,
    `Reason: ${reason}`,
    `Reference: ${booking.id}`,
  ].join("\n");

  const html = renderEmailLayout({
    title: subject,
    preheader: "A direct booking was canceled.",
    bodyHtml: [
      renderParagraph("A direct booking was canceled before capture."),
      renderParagraph(reason),
      renderDetailsTable([
        { label: "Property", value: booking.listing.title },
        { label: "Guest", value: booking.guestEmail },
        { label: "Dates", value: formatDateRange(booking) },
        { label: "Reference", value: booking.id },
      ]),
    ].join(""),
  });

  return { subject, text, html };
}
