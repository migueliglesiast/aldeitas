import type { Booking, Listing } from "@prisma/client";
import { formatMoney } from "@/lib/currency";
import { BOOKING_MAX_PENDING_MINUTES, BOOKING_MIN_CONFIRM_MINUTES } from "@/lib/booking-config";
import { describeCancelReason } from "@/lib/booking-cancel-reasons";
import type { EmailBrand } from "@/lib/email/hotel-brand";
import {
  renderBrandedEmail,
  whatsappLink,
  type EmailTip,
  type ProgressStep,
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

function formatMinutes(minutes: number, lang: "es" | "en") {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    if (lang === "es") return `${hours} ${hours === 1 ? "hora" : "horas"}`;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} min`;
}

const CONFIRM_WINDOW_ES = `normalmente en unos ${formatMinutes(BOOKING_MIN_CONFIRM_MINUTES, "es")}, máximo ${formatMinutes(BOOKING_MAX_PENDING_MINUTES, "es")}`;
const CONFIRM_WINDOW_EN = `usually about ${formatMinutes(BOOKING_MIN_CONFIRM_MINUTES, "en")}, ${formatMinutes(BOOKING_MAX_PENDING_MINUTES, "en")} at most`;

function processingSteps(): ProgressStep[] {
  return [
    { state: "done", title: "Tarjeta autorizada", text: "Apartamos el monto en tu tarjeta. Todavía no hay cargo." },
    {
      state: "active",
      title: "Revisando calendarios",
      text: "Cruzamos tus fechas con Airbnb y las demás plataformas donde se anuncia el cuarto.",
    },
    { state: "todo", title: "Confirmación y cargo", text: `Te llega la confirmación (${CONFIRM_WINDOW_ES}).` },
  ];
}

function confirmedSteps(booking: Booking): ProgressStep[] {
  return [
    { state: "done", title: "Tarjeta autorizada", text: "Todo en orden con tu pago." },
    { state: "done", title: "Fechas aseguradas", text: "Tus noches quedaron bloqueadas en todas las plataformas." },
    { state: "done", title: "Cargo realizado", text: `Cobramos ${formatTotal(booking)}. ¡Listo!` },
  ];
}

function canceledSteps(reasonEs: string): ProgressStep[] {
  return [
    { state: "done", title: "Tarjeta autorizada", text: "Apartamos el monto, sin cargo." },
    { state: "failed", title: "Revisión de calendarios", text: reasonEs },
    { state: "done", title: "Autorización liberada", text: "No se hizo ningún cargo a tu tarjeta." },
  ];
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
  const es = `Tu tarjeta quedó autorizada y todavía no te cobramos nada. Como ${booking.listing.title} también se anuncia en otras plataformas, estamos asegurándonos de que nadie más se quede con tus noches.`;
  const en = `Your card is authorized and nothing has been charged yet. ${booking.listing.title} is also listed on other platforms, so we're checking their calendars to make sure your nights are yours. You'll get the confirmation as soon as everything lines up: ${CONFIRM_WINDOW_EN}.`;

  const html = renderBrandedEmail({
    brand,
    title: subject,
    preheader: `Tarjeta autorizada, sin cargo todavía. Estamos revisando calendarios: ${CONFIRM_WINDOW_ES}.`,
    badge: "Solicitud recibida",
    headline: name ? `¡Ya casi, ${name}!` : `¡Ya casi estás en ${brand.hotelName}!`,
    countdown: countdownLine(booking),
    paragraphs: [es],
    englishNote: en,
    steps: processingSteps(),
    heroPhoto: brand.roomPhotos[0],
    stay: stayTicket(booking, "Total autorizado · Authorized"),
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
    `Total autorizado / Authorized: ${formatTotal(booking)}`,
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
  const es = `Revisamos todos los calendarios, tus noches son tuyas y el cargo ya se realizó. ${booking.listing.title} te está esperando: ya puedes empezar a contar los días.`;
  const en = `We checked every calendar, your nights are locked in and your card has been charged. ${booking.listing.title} is waiting for you, so start counting the days.`;

  const html = renderBrandedEmail({
    brand,
    title: subject,
    preheader: `Tu estancia en ${brand.hotelName} está confirmada.`,
    badge: "✓ Reserva confirmada",
    headline: name ? `¡Nos vemos pronto, ${name}!` : "¡Nos vemos pronto!",
    countdown: countdownLine(booking),
    paragraphs: [es],
    englishNote: en,
    steps: confirmedSteps(booking),
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
  const charged = Boolean(booking.confirmedAt);
  const name = firstName(booking);
  const why = describeCancelReason(reason);
  const subject = charged
    ? `Tu reserva en ${brand.hotelName} fue cancelada`
    : `No pudimos confirmar tu reserva en ${brand.hotelName}`;
  const money = charged
    ? "Vamos a reembolsar el cargo a tu tarjeta; según tu banco, puede tardar de 5 a 10 días hábiles en verse."
    : "No se hizo ningún cargo a tu tarjeta. La autorización temporal desaparece según los tiempos de tu banco.";
  const moneyEn = charged
    ? "We're refunding the charge to your card; depending on your bank it can take 5–10 business days to show."
    : "Your card was not charged. The temporary hold disappears according to your bank's timeline.";
  const en = [why.en, moneyEn, "We'd love to host you on other dates."].filter(Boolean).join(" ");

  const html = renderBrandedEmail({
    brand,
    title: subject,
    preheader: charged ? "Tu reserva fue cancelada. Te reembolsamos el cargo." : "No se hizo ningún cargo a tu tarjeta.",
    badge: charged ? "Reserva cancelada" : "Fechas no disponibles",
    headline: name ? `Lo sentimos, ${name}` : "Lo sentimos mucho",
    paragraphs: [why.es, money, "Nos encantaría recibirte en otras fechas: aquí te esperamos. 🌿"],
    englishNote: en,
    ...(charged ? {} : { steps: canceledSteps(why.es) }),
    facts: [
      { label: "Habitación · Room", value: booking.listing.title },
      { label: "Fechas · Dates", value: formatStayDates(booking) },
      { label: "Referencia · Reference", value: booking.id },
    ],
    ctaLabel: "Buscar otras fechas",
    ctaUrl: brand.siteUrl,
    tips: guestTips(brand)
      .filter((tip) => tip.icon === "💬")
      .map((tip) => ({ ...tip, text: "Te ayudamos a encontrar noches libres." })),
    tipsTitle: "¿Te ayudamos a encontrar otras fechas?",
  });

  const text = plainText([
    `${brand.hotelName} — ${booking.listing.title}`,
    "",
    subject,
    why.es,
    money,
    "",
    `Fechas / Dates: ${formatStayDates(booking)}`,
    `Referencia / Reference: ${booking.id}`,
    "",
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
      `El huésped autorizó el pago (sin cargo todavía). Aldeitas está cruzando las fechas con el calendario de Airbnb y las demás plataformas, y cobrará automáticamente en cuanto confirme (${CONFIRM_WINDOW_ES}). Si otra plataforma vende esas noches antes, se cancela sola y se libera la tarjeta.`,
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
    paragraphs: [
      booking.confirmedAt
        ? "La reserva confirmada se canceló; revisa que el reembolso al huésped se haya procesado."
        : "La reserva se canceló antes del cobro; no se hizo ningún cargo al huésped.",
      `Motivo: ${describeCancelReason(reason).es}`,
    ],
    withCta: false,
  });
}
