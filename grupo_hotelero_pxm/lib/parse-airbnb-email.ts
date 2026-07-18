export type ParsedAirbnbBookingEmail = {
  guestName: string | null;
  guestCount: number | null;
  checkIn: string | null;
  checkOut: string | null;
  listingHint: string | null;
  airbnbListingId: string | null;
  confirmationCode: string | null;
  /** Host payout / "you will earn" amount in minor units (cents). */
  payoutCents: number | null;
  payoutCurrency: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  ene: 0,
  enero: 0,
  feb: 1,
  february: 1,
  febrero: 1,
  mar: 2,
  march: 2,
  marzo: 2,
  apr: 3,
  april: 3,
  abr: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  june: 5,
  junio: 5,
  jul: 6,
  july: 6,
  julio: 6,
  aug: 7,
  august: 7,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septiembre: 8,
  oct: 9,
  october: 9,
  octubre: 9,
  nov: 10,
  november: 10,
  noviembre: 10,
  dec: 11,
  december: 11,
  dic: 11,
  diciembre: 11,
};

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function cleanName(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/[.,;:!]+$/g, "")
    .replace(/\b(arrives|llega|is coming|confirmed|confirmad[oa])\b.*$/i, "")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/^(reservation|reserva|booking|airbnb|guest|hu[eé]sped)/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function toIsoDate(year: number, monthIndex: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseFlexibleDate(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.replace(/\./g, "").replace(/\s+/g, " ").trim();

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 15 ago 2025 / 15 de agosto de 2025 / vie 15 ago 2025
  const es = value.match(
    /(?:[a-záéíóúñ]{2,9}\s+)?(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]{3,12})\s*(?:de\s+)?(\d{4})/i
  );
  if (es) {
    const month = MONTHS[es[2].toLowerCase()];
    if (month != null) return toIsoDate(Number(es[3]), month, Number(es[1]));
  }

  // Aug 15, 2025 / August 15 2025
  const en = value.match(/([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (en) {
    const month = MONTHS[en[1].toLowerCase()];
    if (month != null) return toIsoDate(Number(en[3]), month, Number(en[2]));
  }

  // 15/08/2025 or 08/15/2025 — prefer day-first for MX hosts
  const slash = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    if (a > 12) return toIsoDate(year, b - 1, a);
    if (b > 12) return toIsoDate(year, a - 1, b);
    return toIsoDate(year, b - 1, a);
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function parseMoneyAmount(raw: string): { cents: number; currency: string | null } | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const currencyMatch = cleaned.match(/\b(MXN|USD|EUR|CAD|GBP|AUD)\b/i);
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : null;

  // European: 3.450,00
  const european = cleaned.match(/\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\b/);
  if (european) {
    const amount = Number(european[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) {
      return { cents: Math.round(amount * 100), currency };
    }
  }

  // US / MX Airbnb: $3,450.00 or 3450.00
  const us = cleaned.match(/\$?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)\b/);
  if (us) {
    const amount = Number(us[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      return { cents: Math.round(amount * 100), currency };
    }
  }

  return null;
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#?\w+;/g, " ");
}

function isReservationEmail(subject: string, text: string) {
  const hay = `${subject}\n${text}`.toLowerCase();
  if (!hay.includes("airbnb") && !/reserva|reservation|booking|hu[eé]sped/.test(hay)) {
    return false;
  }

  // Skip pure marketing / tips / reviews when no reservation signals
  const reservationSignal =
    /reserva(ci[oó]n)?\s+confirmad|reservation\s+confirm|booking\s+confirm|new\s+reservation|nueva\s+reserva|alteraci[oó]n|reservation\s+alter|llega el|arrives|check-?in|c[oó]digo de confirmaci[oó]n|confirmation code|ganar[aá]s|you will earn|payout|hu[eé]sped(es)?|guests?/i.test(
      `${subject}\n${text}`
    );
  if (!reservationSignal) return false;

  const marketingOnly =
    /airbnb\.com\/help|weekly update|host tips|inspiration|wishlist|experience near/i.test(
      hay
    ) && !/confirm|reserva|reservation|llega|arrives|confirmation code|c[oó]digo/i.test(hay);
  return !marketingOnly;
}

/** Best-effort parse of Airbnb reservation confirmation / alteration emails. */
export function parseAirbnbBookingEmail(input: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): ParsedAirbnbBookingEmail | null {
  const subject = input.subject || "";
  const bodyText = [input.text || "", stripHtml(input.html || "")].join("\n");
  const text = [subject, bodyText]
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  if (!isReservationEmail(subject, text)) return null;

  const guestName = cleanName(
    firstMatch(text, [
      /(?:reservation confirmed|confirmaci[oó]n de reserva|reserva confirmada)[^\n]{0,40}[-–:]\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+(?:llega|arrives)/i,
      /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+llega(?:\s+el)?\b/i,
      /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+arrives\b/i,
      /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+is\s+coming/i,
      /(?:guest|hu[eé]sped|traveler|traveller|nombre)\s*[:\-–]\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-\s]{1,80})/i,
      /^([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,2})\s*$/m,
    ])
  );

  const guestCountRaw = firstMatch(text, [
    /(\d+)\s*(?:guests?|hu[eé]spedes?|huespedes?|adults?|travelers?|travellers?|personas?)\b/i,
    /(?:guests?|hu[eé]spedes?|huespedes?)\s*[:\-–]?\s*(\d+)/i,
  ]);
  const guestCount = guestCountRaw ? Number(guestCountRaw) : null;

  const checkIn = parseFlexibleDate(
    firstMatch(text, [
      /(?:check[-\s]?in|llegada|start date|fecha de llegada)\s*[:\-–]?\s*([^\n]{6,40})/i,
      /llega(?:\s+el)?\s+([^\n.]{6,40})/i,
      /arrives(?:\s+on)?\s+([^\n.]{6,40})/i,
      /(\d{1,2}\s+(?:de\s+)?[A-Za-zÁÉÍÓÚáéíóúñ.]{3,12}\s+(?:de\s+)?\d{4})/i,
    ])
  );

  const checkOut = parseFlexibleDate(
    firstMatch(text, [
      /(?:check[-\s]?out|salida|end date|fecha de salida)\s*[:\-–]?\s*([^\n]{6,40})/i,
      /(?:to|–|-|through|hasta)\s+(\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:de\s+)?[A-Za-zÁÉÍÓÚáéíóúñ.]{3,12}\s+(?:de\s+)?\d{4})/i,
    ])
  );

  const airbnbListingId = firstMatch(text, [
    /airbnb\.[a-z.]+\/rooms\/(\d{5,})/i,
    /listing[_/\s-]?id\s*[:\-–]?\s*(\d{5,})/i,
    /\/rooms\/(\d{5,})/i,
  ]);

  const listingHint = firstMatch(text, [
    /(?:listing|propiedad|alojamiento|anuncio|room)\s*[:\-–]\s*([^\n]{3,140})/i,
    /(?:confirmed for|confirmad[oa] para|reserva(?:da)? en)\s+([^\n]{3,140})/i,
    /(?:staying at|se alojar[aá] en|en tu anuncio)\s+([^\n]{3,140})/i,
  ]);

  const confirmationCode = firstMatch(text, [
    /confirmation\s+code\s*[:\-–]?\s*([A-Z0-9]{8,12})/i,
    /c[oó]digo\s+de\s+confirmaci[oó]n\s*[:\-–]?\s*([A-Z0-9]{8,12})/i,
    /\b(HM[A-Z0-9]{8,})\b/,
  ]);

  const payoutRaw = firstMatch(text, [
    /(?:you will earn|you'll earn|ganar[aá]s|ganaras|payout|pago(?:\s+previsto)?|expected payout|total\s*\(host\))\s*[:\-–]?\s*([^\n]{4,40})/i,
    /(?:earn|ganar)\s+([\$€]?\s*[\d.,]+\s*(?:MXN|USD|EUR)?)/i,
  ]);
  const payout = payoutRaw ? parseMoneyAmount(payoutRaw) : null;

  if (
    !guestName &&
    !guestCount &&
    !checkIn &&
    !airbnbListingId &&
    !confirmationCode &&
    !listingHint &&
    !payout
  ) {
    return null;
  }

  return {
    guestName,
    guestCount:
      guestCount != null && Number.isFinite(guestCount) && guestCount > 0 && guestCount <= 50
        ? guestCount
        : null,
    checkIn,
    checkOut,
    listingHint: listingHint ? listingHint.replace(/\s+/g, " ").trim().slice(0, 140) : null,
    airbnbListingId,
    confirmationCode,
    payoutCents: payout?.cents ?? null,
    payoutCurrency: payout?.currency ?? null,
  };
}

/** Normalize text for fuzzy listing-title matching. */
export function normalizeListingMatchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well a room title / calendar name appears in email text.
 * Higher is better; 0 means no useful match.
 */
export function scoreListingNameInText(
  listingTitle: string,
  emailText: string,
  extraNames: string[] = []
): number {
  const haystack = normalizeListingMatchText(emailText);
  if (!haystack) return 0;

  const candidates = [listingTitle, ...extraNames]
    .map((name) => normalizeListingMatchText(name))
    .filter((name) => name.length >= 3);

  let best = 0;
  for (const name of candidates) {
    if (haystack.includes(name)) {
      best = Math.max(best, 100 + name.length);
      continue;
    }
    const tokens = name.split(" ").filter((token) => token.length >= 3);
    if (tokens.length === 0) continue;
    const hit = tokens.filter((token) => haystack.includes(token)).length;
    if (hit === 0) continue;
    const ratio = hit / tokens.length;
    if (ratio >= 0.6) {
      best = Math.max(best, Math.round(ratio * 80) + name.length);
    }
  }
  return best;
}
