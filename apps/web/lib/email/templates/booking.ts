import type { Booking, Listing } from "@prisma/client";
import { formatMoney } from "@/lib/currency";
import type { EmailBrand } from "@/lib/email/hotel-brand";
import { renderBrandedEmail, type StayFact } from "@/lib/email/templates/branded-layout";

export type BookingWithListing = Booking & { listing: Listing };

type EmailMessage = { subject: string; text: string; html: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDay(date: Date, locale: string, withYear = false) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date);
}

export function formatStayDates(booking: Booking) {
  return `${formatDay(booking.startDate, "es-MX")} – ${formatDay(booking.endDate, "es-MX", true)}`;
}

export function countNights(booking: Booking) {
  return Math.max(1, Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / DAY_MS));
}

function formatTotal(booking: Booking) {
  return formatMoney(booking.totalPriceCents, booking.currency);
}

function firstName(booking: Booking) {
  return booking.guestName?.trim().split(/\s+/)[0] || null;
}

function bookingStatusUrl(brand: EmailBrand, bookingId: string) {
  return `${brand.siteUrl}/booking/${bookingId}`;
}

function excerpt(text: string | null, max = 240) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
}

function stayHighlights(booking: Booking): StayFact[] {
  const nights = countNights(booking);
  return [
    { label: "Llegada · In", value: formatDay(booking.startDate, "es-MX") },
    { label: "Salida · Out", value: formatDay(booking.endDate, "es-MX") },
    { label: "Noches · Nights", value: String(nights) },
  ];
}

function guestFacts(booking: BookingWithListing, totalLabel: string): StayFact[] {
  const facts: StayFact[] = [{ label: "Habitación · Room", value: booking.listing.title }];
  if (booking.guestCount) facts.push({ label: "Huéspedes · Guests", value: String(booking.guestCount) });
  facts.push({ label: totalLabel, value: formatTotal(booking) });
  facts.push({ label: "Referencia · Reference", value: booking.id });
  return facts;
}

function adminFacts(booking: BookingWithListing): StayFact[] {
  return [
    { label: "Habitación", value: booking.listing.title },
    { label: "Fechas", value: `${formatStayDates(booking)} (${countNights(booking)} noches)` },
    { label: "Total", value: formatTotal(booking) },
    ...(booking.guestName ? [{ label: "Huésped", value: booking.guestName }] : []),
    { label: "Correo", value: booking.guestEmail },
    { label: "Teléfono", value: booking.guestPhone },
    { label: "Referencia", value: booking.id },
  ];
}

function plainText(lines: Array<string | null | false | undefined>) {
  return lines.filter((line): line is string => typeof line === "string").join("\n");
}

export function buildBookingProcessingEmail(booking: BookingWithListing, brand: EmailBrand): EmailMessage {
  const statusUrl = bookingStatusUrl(brand, booking.id);
  const name = firstName(booking);
  const subject = `Recibimos tu reserva en ${brand.hotelName} · ${booking.listing.title}`;
  const es =
    "Tu tarjeta quedó autorizada, pero todavía no se ha hecho ningún cargo. Estamos asegurando tus fechas en todos nuestros canales; toma hasta 2 horas y te escribimos en cuanto quede confirmada.";
  const en =
    "Your card is authorized but not charged yet. We're securing your dates across all our channels. It takes up to 2 hours, and we'll email you as soon as it's confirmed.";

  const html = renderBrandedEmail({
    brand,
    title: subject,
    preheader: "Tarjeta autorizada, sin cargo todavía. Estamos confirmando tus fechas.",
    eyebrow: "Solicitud recibida · Request received",
    headline: name ? `¡Ya casi, ${name}!` : `¡Ya casi estás en ${brand.hotelName}!`,
    subline: `Your stay at ${brand.hotelName} is almost booked.`,
    paragraphs: [es, en],
    heroPhoto: brand.roomPhotos[0],
    highlights: stayHighlights(booking),
    facts: guestFacts(booking, "Total estimado · Estimated total"),
    ctaLabel: "Ver mi reserva · View booking",
    ctaUrl: statusUrl,
    galleryPhotos: brand.roomPhotos.slice(1, 3),
    quote: excerpt(brand.roomDescription),
    showContact: true,
  });

  const text = plainText([
    `${brand.hotelName} — ${booking.listing.title}`,
    "",
    es,
    "",
    `Fechas / Dates: ${formatStayDates(booking)} (${countNights(booking)} noches)`,
    `Total estimado / Estimated total: ${formatTotal(booking)}`,
    `Referencia / Reference: ${booking.id}`,
    "",
    en,
    "",
    `Ver mi reserva / View booking: ${statusUrl}`,
    brand.contactPhone && `WhatsApp: ${brand.contactPhone}`,
  ]);

  return { subject, text, html };
}

export function buildBookingConfirmedEmail(booking: BookingWithListing, brand: EmailBrand): EmailMessage {
  const statusUrl = bookingStatusUrl(brand, booking.id);
  const name = firstName(booking);
  const subject = `Reserva confirmada en ${brand.hotelName} · ${formatStayDates(booking)}`;
  const es = `Tu reserva está confirmada y el cargo ya se realizó. ${booking.listing.title} te está esperando: ya puedes empezar a contar los días.`;
  const en = `Your booking is confirmed and your card has been charged. ${booking.listing.title} is waiting for you, so start counting the days.`;

  const html = renderBrandedEmail({
    brand,
    title: subject,
    preheader: `Tu estancia en ${brand.hotelName} está confirmada.`,
    eyebrow: "Reserva confirmada · Booking confirmed",
    headline: name ? `¡Nos vemos pronto, ${name}!` : "¡Nos vemos pronto!",
    subline: `Your stay at ${brand.hotelName} is confirmed.`,
    paragraphs: [es, en],
    heroPhoto: brand.roomPhotos[0],
    highlights: stayHighlights(booking),
    facts: guestFacts(booking, "Total pagado · Total paid"),
    ctaLabel: "Ver mi reserva · View booking",
    ctaUrl: statusUrl,
    galleryPhotos: brand.roomPhotos.slice(1, 3),
    quote: excerpt(brand.roomDescription),
    showContact: true,
  });

  const text = plainText([
    `${brand.hotelName} — ${booking.listing.title}`,
    "",
    es,
    "",
    `Fechas / Dates: ${formatStayDates(booking)} (${countNights(booking)} noches)`,
    `Total pagado / Total paid: ${formatTotal(booking)}`,
    `Referencia / Reference: ${booking.id}`,
    "",
    en,
    "",
    `Ver mi reserva / View booking: ${statusUrl}`,
    brand.contactPhone && `WhatsApp: ${brand.contactPhone}`,
  ]);

  return { subject, text, html };
}

export function buildBookingCanceledEmail(
  booking: BookingWithListing,
  reason: string,
  brand: EmailBrand
): EmailMessage {
  const subject = `Actualización de tu reserva en ${brand.hotelName}`;
  const es =
    "No se hizo ningún cargo a tu tarjeta. La autorización temporal desaparecerá según los tiempos de tu banco.";
  const en = "Your card was not charged. The temporary hold will disappear according to your bank's timeline.";

  const html = renderBrandedEmail({
    brand,
    title: subject,
    preheader: "No pudimos confirmar tu reserva. No se hizo ningún cargo.",
    eyebrow: "Actualización · Update",
    headline: "No pudimos confirmar tu reserva",
    subline: `We couldn't confirm your booking at ${brand.hotelName}.`,
    paragraphs: [reason, es, en],
    facts: [
      { label: "Habitación · Room", value: booking.listing.title },
      { label: "Fechas · Dates", value: formatStayDates(booking) },
      { label: "Referencia · Reference", value: booking.id },
    ],
    ctaLabel: "Buscar otras fechas · Find other dates",
    ctaUrl: brand.siteUrl,
    showContact: true,
  });

  const text = plainText([
    `${brand.hotelName} — ${booking.listing.title}`,
    "",
    "No pudimos confirmar tu reserva / We couldn't confirm your booking.",
    reason,
    "",
    `Fechas / Dates: ${formatStayDates(booking)}`,
    `Referencia / Reference: ${booking.id}`,
    "",
    es,
    en,
    "",
    `Buscar otras fechas / Find other dates: ${brand.siteUrl}`,
  ]);

  return { subject, text, html };
}

function adminMessage(
  booking: BookingWithListing,
  brand: EmailBrand,
  opts: { subject: string; eyebrow: string; headline: string; paragraphs: string[]; withCta: boolean }
): EmailMessage {
  const statusUrl = bookingStatusUrl(brand, booking.id);
  const facts = adminFacts(booking);
  const html = renderBrandedEmail({
    brand,
    title: opts.subject,
    preheader: opts.headline,
    eyebrow: opts.eyebrow,
    headline: opts.headline,
    paragraphs: opts.paragraphs,
    heroPhoto: brand.roomPhotos[0],
    facts,
    ...(opts.withCta ? { ctaLabel: "Abrir reserva", ctaUrl: statusUrl } : {}),
  });
  const text = plainText([
    opts.headline,
    ...opts.paragraphs,
    "",
    ...facts.map((fact) => `${fact.label}: ${fact.value}`),
    opts.withCta && "",
    opts.withCta && `Abrir reserva: ${statusUrl}`,
  ]);
  return { subject: opts.subject, text, html };
}

export function buildAdminBookingProcessingEmail(booking: BookingWithListing, brand: EmailBrand) {
  return adminMessage(booking, brand, {
    subject: `Nueva reserva directa: ${booking.listing.title} · ${formatStayDates(booking)}`,
    eyebrow: `${brand.hotelName} · Nueva reserva`,
    headline: `Nueva reserva en ${booking.listing.title}`,
    paragraphs: [
      "El huésped autorizó el pago. Aldeitas está revisando los calendarios y cobrará automáticamente en cuanto confirme las fechas.",
    ],
    withCta: true,
  });
}

export function buildAdminBookingConfirmedEmail(booking: BookingWithListing, brand: EmailBrand) {
  return adminMessage(booking, brand, {
    subject: `Reserva confirmada: ${booking.listing.title} · ${formatStayDates(booking)}`,
    eyebrow: `${brand.hotelName} · Confirmada`,
    headline: `Reserva confirmada en ${booking.listing.title}`,
    paragraphs: ["Las fechas quedaron confirmadas y el pago se cobró."],
    withCta: true,
  });
}

export function buildAdminBookingCanceledEmail(booking: BookingWithListing, reason: string, brand: EmailBrand) {
  return adminMessage(booking, brand, {
    subject: `Reserva cancelada: ${booking.listing.title} · ${formatStayDates(booking)}`,
    eyebrow: `${brand.hotelName} · Cancelada`,
    headline: `Reserva cancelada en ${booking.listing.title}`,
    paragraphs: ["La reserva se canceló antes del cobro; no se hizo ningún cargo al huésped.", `Motivo: ${reason}`],
    withCta: false,
  });
}
