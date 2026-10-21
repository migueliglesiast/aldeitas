import type { Booking, Listing } from "@prisma/client";
import { formatMoney } from "@/lib/currency";
import type { EmailBrand } from "@/lib/email/hotel-brand";
import {
  renderBrandedEmail,
  whatsappLink,
  type EmailTip,
  type StayFact,
  type StayTicket,
} from "@/lib/email/templates/branded-layout";

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

export function countdownLine(booking: Booking, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((booking.startDate.getTime() - today) / DAY_MS);
  if (days < 0) return null;
  if (days === 0) return "¡Llegas hoy! ☀️";
  if (days === 1) return "¡Llegas mañana! 🌴";
  return `Faltan ${days} días para tu llegada 🌴`;
}

function stayTicket(booking: BookingWithListing, totalLabel: string): StayTicket {
  const nights = countNights(booking);
  const details = [`${nights} ${nights === 1 ? "noche" : "noches"}`];
  if (booking.guestCount) details.push(`${booking.guestCount} ${booking.guestCount === 1 ? "huésped" : "huéspedes"}`);
  return {
    checkIn: booking.startDate,
    checkOut: booking.endDate,
    room: booking.listing.title,
    details,
    facts: [
      { label: totalLabel, value: formatTotal(booking) },
      { label: "Referencia · Ref", value: booking.id },
    ],
  };
}

function guestTips(brand: EmailBrand): EmailTip[] {
  const tips: EmailTip[] = [];
  const whatsapp = whatsappLink(brand.contactPhone);
  if (whatsapp) {
    tips.push({
      icon: "💬",
      title: "Escríbenos por WhatsApp",
      text: "Coordina tu hora de llegada o pregúntanos lo que quieras.",
      url: whatsapp,
    });
  }
  if (brand.mapsUrl) {
    tips.push({ icon: "📍", title: "Cómo llegar", text: brand.location ?? "Abre la ubicación en tu mapa.", url: brand.mapsUrl });
  }
  tips.push({ icon: "🧳", title: "Guarda este correo", text: "Tu referencia agiliza el check-in." });
  return tips;
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
    badge: "Solicitud recibida",
    headline: name ? `¡Ya casi, ${name}!` : `¡Ya casi estás en ${brand.hotelName}!`,
    countdown: countdownLine(booking),
    paragraphs: [es],
    englishNote: en,
    heroPhoto: brand.roomPhotos[0],
    stay: stayTicket(booking, "Total estimado · Est. total"),
    ctaLabel: "Ver mi reserva",
    ctaUrl: statusUrl,
    galleryPhotos: brand.roomPhotos.slice(1, 3),
    galleryCaption: `Tu rincón · ${booking.listing.title}`,
    quote: excerpt(brand.roomDescription),
    tips: guestTips(brand),
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
    badge: "✓ Reserva confirmada",
    headline: name ? `¡Nos vemos pronto, ${name}!` : "¡Nos vemos pronto!",
    countdown: countdownLine(booking),
    paragraphs: [es],
    englishNote: en,
    heroPhoto: brand.roomPhotos[0],
    stay: stayTicket(booking, "Total pagado · Paid"),
    ctaLabel: "Ver mi reserva",
    ctaUrl: statusUrl,
    galleryPhotos: brand.roomPhotos.slice(1, 3),
    galleryCaption: `Tu rincón · ${booking.listing.title}`,
    quote: excerpt(brand.roomDescription),
    tips: guestTips(brand),
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
    badge: "Actualización",
    headline: "No pudimos confirmar tu reserva",
    paragraphs: [reason, es],
    englishNote: `We couldn't confirm your booking at ${brand.hotelName}. ${en}`,
    facts: [
      { label: "Habitación · Room", value: booking.listing.title },
      { label: "Fechas · Dates", value: formatStayDates(booking) },
      { label: "Referencia · Reference", value: booking.id },
    ],
    ctaLabel: "Buscar otras fechas",
    ctaUrl: brand.siteUrl,
    tips: guestTips(brand).filter((tip) => tip.icon === "💬"),
    tipsTitle: "¿Te ayudamos a encontrar otras fechas?",
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
  opts: { subject: string; badge: string; headline: string; paragraphs: string[]; withCta: boolean }
): EmailMessage {
  const statusUrl = bookingStatusUrl(brand, booking.id);
  const facts = adminFacts(booking);
  const html = renderBrandedEmail({
    brand,
    title: opts.subject,
    preheader: opts.headline,
    badge: opts.badge,
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
    badge: `${brand.hotelName} · Nueva reserva`,
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
    badge: `${brand.hotelName} · Confirmada`,
    headline: `Reserva confirmada en ${booking.listing.title}`,
    paragraphs: ["Las fechas quedaron confirmadas y el pago se cobró."],
    withCta: true,
  });
}

export function buildAdminBookingCanceledEmail(booking: BookingWithListing, reason: string, brand: EmailBrand) {
  return adminMessage(booking, brand, {
    subject: `Reserva cancelada: ${booking.listing.title} · ${formatStayDates(booking)}`,
    badge: `${brand.hotelName} · Cancelada`,
    headline: `Reserva cancelada en ${booking.listing.title}`,
    paragraphs: ["La reserva se canceló antes del cobro; no se hizo ningún cargo al huésped.", `Motivo: ${reason}`],
    withCta: false,
  });
}
