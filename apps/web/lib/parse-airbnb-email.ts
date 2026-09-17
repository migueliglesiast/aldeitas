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
  /** Year was missing in the email and inferred from the email Date. */
  yearInferred: boolean;
  /** Inferred year looks ambiguous — show in admin for manual fix. */
  yearNeedsReview: boolean;
  yearReviewNote: string | null;
};

export type ParsedFlexibleDate = {
  iso: string;
  yearInferred: boolean;
  uncertain: boolean;
  reason: string | null;
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
    .replace(/\b(arrives|llega|is coming|confirmed|confirmad[oa]|booking|reservation|reserva)\b.*$/i, "")
    // Strip Airbnb deep-link / tracking prefixes that sometimes precede the name
    .replace(/^[a-f0-9-]{20,}\s+/i, "")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/^[a-f0-9-]{16,}$/i.test(cleaned)) return null;
  if (/^(reservation|reserva|booking|airbnb|guest|hu[eé]sped|new booking)\b/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

/** Airbnb confirmation emails often put both dates on one line under "Check-in  Checkout". */
function parseCheckInCheckOutPair(
  text: string,
  referenceDate?: Date | null
): {
  checkIn: ParsedFlexibleDate | null;
  checkOut: ParsedFlexibleDate | null;
} {
  // After whitespace collapse, the block looks like:
  // Check-in Checkout
  // Mon, Aug 3 Fri, Aug 7
  const pair =
    text.match(
      /check[-\s]?in\s+check(?:\s|-)?out\s*\n+\s*((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?)\s+((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?)/i
    ) ||
    text.match(
      /check[-\s]?in\s+check(?:\s|-)?out\s*\n+\s*([a-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)\s+([a-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i
    ) ||
    text.match(
      /llegada\s+salida\s*\n+\s*((?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)[a-z.]*\s+\d{1,2}\s+(?:de\s+)?[a-záéíóúñ.]{3,12}(?:\s+(?:de\s+)?\d{4})?)\s+((?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)[a-z.]*\s+\d{1,2}\s+(?:de\s+)?[a-záéíóúñ.]{3,12}(?:\s+(?:de\s+)?\d{4})?)/i
    );

  if (!pair) return { checkIn: null, checkOut: null };
  const checkIn = parseFlexibleDate(pair[1], referenceDate);
  const checkoutReference = checkIn
    ? new Date(`${checkIn.iso}T12:00:00`)
    : referenceDate;
  const checkOut = parseFlexibleDate(pair[2], checkoutReference);
  return { checkIn, checkOut };
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

/** Pick year for Airbnb dates that omit it (e.g. "Tue, Jul 21 at 3:00 PM"). */
function resolveYearlessDate(
  monthIndex: number,
  day: number,
  reference?: Date | null
): ParsedFlexibleDate | null {
  const ref =
    reference && !Number.isNaN(reference.getTime()) ? reference : new Date();
  const emailDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const y0 = emailDay.getFullYear();

  const candidates = [y0 - 1, y0, y0 + 1]
    .map((year) => {
      const iso = toIsoDate(year, monthIndex, day);
      if (!iso) return null;
      const date = new Date(year, monthIndex, day);
      const deltaDays = Math.round(
        (date.getTime() - emailDay.getTime()) / (24 * 60 * 60 * 1000)
      );
      return { year, iso, date, deltaDays };
    })
    .filter(Boolean) as Array<{
    year: number;
    iso: string;
    date: Date;
    deltaDays: number;
  }>;

  if (!candidates.length) return null;

  // Confirmations are almost always for today or a future stay.
  const upcoming = candidates
    .filter((c) => c.deltaDays >= -1)
    .sort((a, b) => a.deltaDays - b.deltaDays);

  if (upcoming.length) {
    const best = upcoming[0];
    const runnerUp = upcoming[1];
    let uncertain = false;
    let reason: string | null = null;

    if (best.year !== y0) {
      uncertain = true;
      reason = `No year in email; inferred ${best.year} from email dated ${toIsoDate(y0, emailDay.getMonth(), emailDay.getDate())}`;
    }
    if (best.deltaDays > 180) {
      uncertain = true;
      reason = `Stay is ${best.deltaDays} days after the email — year may be wrong`;
    }
    // Two plausible years close together (boundary / coinciding ambiguity)
    if (
      runnerUp &&
      Math.abs(runnerUp.deltaDays - best.deltaDays) <= 40 &&
      runnerUp.year !== best.year
    ) {
      uncertain = true;
      reason = `Ambiguous year: could be ${best.year} or ${runnerUp.year}`;
    }
    // Same year + near-term stay with no competing candidate → confident
    if (
      best.year === y0 &&
      best.deltaDays <= 45 &&
      !(
        runnerUp &&
        Math.abs(runnerUp.deltaDays - best.deltaDays) <= 40 &&
        runnerUp.year !== best.year
      )
    ) {
      uncertain = false;
      reason = null;
    }

    return {
      iso: best.iso,
      yearInferred: true,
      uncertain,
      reason,
    };
  }

  // All options are in the past — late confirmation / forwarded mail
  const past = [...candidates].sort((a, b) => b.deltaDays - a.deltaDays)[0];
  return {
    iso: past.iso,
    yearInferred: true,
    uncertain: true,
    reason: `Check-in appears before the email date; assumed ${past.year}`,
  };
}

function parseFlexibleDate(
  raw: string | null,
  referenceDate?: Date | null
): ParsedFlexibleDate | null {
  if (!raw) return null;
  const value = raw
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/\bat\s+\d{1,2}:\d{2}\s*(am|pm)?/gi, "")
    .trim();

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return {
      iso: `${iso[1]}-${iso[2]}-${iso[3]}`,
      yearInferred: false,
      uncertain: false,
      reason: null,
    };
  }

  // 15 ago 2025 / 15 de agosto de 2025 / vie 15 ago 2025
  const es = value.match(
    /(?:[a-záéíóúñ]{2,9}\s+)?(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]{3,12})\s*(?:de\s+)?(\d{4})/i
  );
  if (es) {
    const month = MONTHS[es[2].toLowerCase()];
    if (month != null) {
      const resolved = toIsoDate(Number(es[3]), month, Number(es[1]));
      if (resolved) {
        return {
          iso: resolved,
          yearInferred: false,
          uncertain: false,
          reason: null,
        };
      }
    }
  }

  // Aug 15, 2025 / August 15 2025
  const enWithYear = value.match(/([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (enWithYear) {
    const month = MONTHS[enWithYear[1].toLowerCase()];
    if (month != null) {
      const resolved = toIsoDate(
        Number(enWithYear[3]),
        month,
        Number(enWithYear[2])
      );
      if (resolved) {
        return {
          iso: resolved,
          yearInferred: false,
          uncertain: false,
          reason: null,
        };
      }
    }
  }

  // Tue, Jul 21 / Jul 21  (no year — common in Airbnb emails)
  const enNoYear = value.match(
    /(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s|,|$)/i
  );
  if (enNoYear) {
    const month = MONTHS[enNoYear[1].toLowerCase()];
    if (month != null) {
      return resolveYearlessDate(month, Number(enNoYear[2]), referenceDate);
    }
  }

  const esNoYear = value.match(
    /(?:[a-záéíóúñ]{2,9},?\s+)?(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]{3,12})\b/i
  );
  if (esNoYear) {
    const month = MONTHS[esNoYear[2].toLowerCase()];
    if (month != null) {
      return resolveYearlessDate(month, Number(esNoYear[1]), referenceDate);
    }
  }

  // 15/08/2025 or 08/15/2025 — prefer day-first for MX hosts
  const slash = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const resolved =
      a > 12
        ? toIsoDate(year, b - 1, a)
        : b > 12
          ? toIsoDate(year, a - 1, b)
          : toIsoDate(year, b - 1, a);
    if (resolved) {
      return {
        iso: resolved,
        yearInferred: false,
        uncertain: false,
        reason: null,
      };
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(value)) {
    const resolved = toIsoDate(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    );
    if (resolved) {
      return {
        iso: resolved,
        yearInferred: false,
        uncertain: false,
        reason: null,
      };
    }
  }
  return null;
}

/** Ensure checkout is on/after check-in; if yearless checkout wrapped wrong, bump year. */
function alignCheckoutToCheckIn(
  checkIn: ParsedFlexibleDate,
  checkOut: ParsedFlexibleDate | null
): ParsedFlexibleDate | null {
  if (!checkOut) return null;
  if (checkOut.iso >= checkIn.iso) return checkOut;

  // Checkout month/day before check-in → crossed New Year
  const [y, m, d] = checkOut.iso.split("-").map(Number);
  const bumped = toIsoDate(y + 1, m - 1, d);
  if (!bumped) return checkOut;
  return {
    iso: bumped,
    yearInferred: true,
    uncertain: true,
    reason: `Checkout year adjusted to ${y + 1} so it falls after check-in`,
  };
}

function parseMoneyAmount(raw: string): { cents: number; currency: string | null } | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  // Reject labels that are not dollar amounts (e.g. "2 nights room fee")
  if (!/[\$€]|MXN|USD|EUR|\d+[.,]\d{2}/i.test(cleaned)) return null;

  const currencyMatch = cleaned.match(/\b(MXN|USD|EUR|CAD|GBP|AUD)\b/i);
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : null;

  // European: 3.450,00
  const european = cleaned.match(/\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\b/);
  if (european && /[\$€]|MXN|USD|EUR|,|\./i.test(cleaned)) {
    const amount = Number(european[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) {
      return { cents: Math.round(amount * 100), currency };
    }
  }

  // Prefer amounts with $ or thousands separators / decimals
  const us = cleaned.match(
    /\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2}|\d{1,3}(?:,\d{3})+|\d{2,})/
  );
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
  const subjectOk =
    /reservation confirmed|reserva confirmada|booking confirmed|new booking confirmed|nueva reserva|reservation altered|alteraci[oó]n de la reserva|pending reservation/i.test(
      subject
    );
  if (!subjectOk && !hay.includes("airbnb")) return false;

  const reservationSignal =
    subjectOk ||
    /reserva(ci[oó]n)?\s+confirmad|reservation\s+confirm|booking\s+confirm|new booking confirmed|new\s+reservation|nueva\s+reserva|alteraci[oó]n|reservation\s+alter|confirmation code|c[oó]digo de confirmaci[oó]n|you earn|ganar[aá]s/i.test(
      `${subject}\n${text}`
    );
  if (!reservationSignal) return false;

  const marketingOnly =
    /airbnb\.com\/help|weekly update|host tips|inspiration|wishlist|experience near|left a \d-star review/i.test(
      hay
    ) && !subjectOk;
  return !marketingOnly;
}

/** Best-effort parse of Airbnb reservation confirmation / alteration emails. */
export function parseAirbnbBookingEmail(input: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  /** Email Date header — used to infer year when Airbnb omits it. */
  referenceDate?: Date | string | null;
}): ParsedAirbnbBookingEmail | null {
  const subject = input.subject || "";
  const richText = input.text || "";
  const html = input.html || "";
  // Avoid stripping huge HTML on every email when plain text already exists (Hostinger time).
  const bodyText = [
    richText,
    richText.length > 200 ? "" : stripHtml(html),
  ].join("\n");
  const text = [subject, bodyText]
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  if (!isReservationEmail(subject, text)) return null;

  const referenceDate =
    input.referenceDate instanceof Date
      ? input.referenceDate
      : input.referenceDate
        ? new Date(input.referenceDate)
        : null;

  const guestName = cleanName(
    firstMatch(text, [
      /(?:reservation confirmed|confirmaci[oó]n de reserva|reserva confirmada)\s*[-–:]\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,4})\s+(?:llega|arrives)/i,
      /new booking confirmed!\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+arrives/i,
      /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,4})\s+llega(?:\s+el)?\b/i,
      /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,4})\s+arrives\b/i,
      /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+is\s+coming/i,
      /(?:guest|hu[eé]sped|traveler|traveller|nombre)\s*[:\-–]\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-\s]{1,80})/i,
    ])
  );

  const guestCountRaw = firstMatch(text, [
    /(\d+)\s*adults?(?:\s*,?\s*\d+\s*children?)?(?:\s*,?\s*\d+\s*infants?)?/i,
    /(?:guests?|hu[eé]spedes?|huespedes?)\s*\n+\s*(\d+)\s*(?:adults?|guests?|hu[eé]spedes?)?/i,
    /(\d+)\s*(?:guests?|hu[eé]spedes?|huespedes?|travelers?|travellers?|personas?)\b/i,
  ]);
  const guestCount = guestCountRaw ? Number(guestCountRaw) : null;

  // Prefer the paired Check-in / Checkout block Airbnb uses in confirmation emails.
  const paired = parseCheckInCheckOutPair(text, referenceDate);

  // Subject / headline: "… arrives Aug 3" (do not use "confirm check-in details").
  const subjectOrHeadlineCheckIn = parseFlexibleDate(
    firstMatch(text, [
      /(?:reservation confirmed|reserva confirmada)[^\n]*\barrives\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      /new booking confirmed![^\n]*\barrives\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      /\barrives\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      /(?:reservation confirmed|reserva confirmada)[^\n]*\bllega(?:\s+el)?\s+([^\n.]{4,40})/i,
      /\bllega(?:\s+el)?\s+([^\n.]{4,40})/i,
    ]),
    referenceDate
  );

  const labeledCheckIn = parseFlexibleDate(
    firstMatch(text, [
      // Require a real date-ish token after the label (avoid "check-in details")
      /(?:^|\n)\s*check[-\s]?in\s*[:\-–]?\s*\n?\s*((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|[a-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+(?:de\s+)?[a-záéíóúñ.]{3,12}(?:\s+(?:de\s+)?\d{4})?|\d{4}-\d{2}-\d{2})/im,
      /(?:^|\n)\s*(?:llegada|start date|fecha de llegada)\s*[:\-–]?\s*\n?\s*([^\n]{4,50})/im,
    ]),
    referenceDate
  );

  const checkInRaw =
    paired.checkIn || subjectOrHeadlineCheckIn || labeledCheckIn;

  const checkoutReference =
    checkInRaw != null
      ? new Date(`${checkInRaw.iso}T12:00:00`)
      : referenceDate;

  const labeledCheckOut = parseFlexibleDate(
    firstMatch(text, [
      /(?:^|\n)\s*check(?:\s|-)?out\s*[:\-–]?\s*\n?\s*((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|[a-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+(?:de\s+)?[a-záéíóúñ.]{3,12}(?:\s+(?:de\s+)?\d{4})?|\d{4}-\d{2}-\d{2})/im,
      /(?:^|\n)\s*(?:salida|end date|fecha de salida)\s*[:\-–]?\s*\n?\s*([^\n]{4,50})/im,
    ]),
    checkoutReference
  );

  const checkOutParsed = paired.checkOut || labeledCheckOut;

  const checkOutRaw =
    checkInRaw != null
      ? alignCheckoutToCheckIn(checkInRaw, checkOutParsed)
      : checkOutParsed;

  const checkIn = checkInRaw?.iso ?? null;
  const checkOut = checkOutRaw?.iso ?? null;
  const yearInferred = Boolean(
    checkInRaw?.yearInferred || checkOutRaw?.yearInferred
  );
  const yearNeedsReview = Boolean(
    checkInRaw?.uncertain || checkOutRaw?.uncertain
  );
  const yearReviewNote =
    [checkInRaw?.reason, checkOutRaw?.reason].filter(Boolean).join("; ") ||
    null;

  const airbnbListingId =
    firstMatch(text, [
      /airbnb\.[a-z.]+\/rooms\/(\d{5,})/i,
      /manage-your-space\/(\d{5,})/i,
      /listing[_/\s-]?id\s*[:\-–]?\s*(\d{5,})/i,
      /\/rooms\/(\d{5,})/i,
    ]) ||
    // Listing links are often only in HTML hrefs, not plain text
    firstMatch(html, [
      /airbnb\.[a-z.]+\/rooms\/(\d{5,})/i,
      /manage-your-space\/(\d{5,})/i,
      /\/rooms\/(\d{5,})/i,
      /\/calendar\/ical\/(\d{5,})/i,
      /listing_id=(\d{5,})/i,
    ]);

  const listingHint = firstMatch(text, [
    // Airbnb often puts the listing title on its own line above "Entire home/apt"
    /^([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][^\n]{8,120})\s*\n\s*Entire (?:home|place|apt|villa|bungalow)/im,
    /(?:listing|propiedad|alojamiento|anuncio|room)\s*[:\-–]\s*([^\n]{3,140})/i,
    /(?:confirmed for|confirmad[oa] para|reserva(?:da)? en)\s+([^\n]{3,140})/i,
    /(?:staying at|se alojar[aá] en|en tu anuncio)\s+([^\n]{3,140})/i,
  ]);

  const confirmationCode = firstMatch(text, [
    /confirmation\s+code\s*[:\-–]?\s*\n?\s*([A-Z0-9]{8,12})/i,
    /c[oó]digo\s+de\s+confirmaci[oó]n\s*[:\-–]?\s*\n?\s*([A-Z0-9]{8,12})/i,
    /\b(HM[A-Z0-9]{8,})\b/,
  ]);

  const payoutRaw = firstMatch(text, [
    /you earn\s*[:\-–]?\s*\n?\s*([\$€]?[\d.,]+(?:\s*(?:MXN|USD|EUR))?)/i,
    /(?:you will earn|you'll earn|ganar[aá]s|ganaras)\s*[:\-–]?\s*\n?\s*([\$€]?[\d.,]+(?:\s*(?:MXN|USD|EUR))?)/i,
    /(?:expected payout|host payout)\s*[:\-–]?\s*\n?\s*([\$€][\d.,]+(?:\s*(?:MXN|USD|EUR))?)/i,
  ]);
  let payout = payoutRaw ? parseMoneyAmount(payoutRaw) : null;
  if (!payout) {
    // Fallback: line after "You earn"
    const earnBlock = text.match(/you earn\s*\n+\s*([\$€][\d.,]+)/i);
    if (earnBlock?.[1]) payout = parseMoneyAmount(earnBlock[1]);
  }
  if (payout && !payout.currency && /\bMXN\b/i.test(text)) {
    payout = { ...payout, currency: "MXN" };
  }

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
    yearInferred,
    yearNeedsReview,
    yearReviewNote,
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
    // Also: email listing title contained in room title (or reverse) for long Airbnb names
    if (name.length >= 12 && (haystack.includes(name.slice(0, 20)) || name.includes(haystack.slice(0, 20)))) {
      best = Math.max(best, 70);
    }
    const tokens = name.split(" ").filter((token) => token.length >= 3);
    if (tokens.length === 0) continue;
    const hit = tokens.filter((token) => haystack.includes(token)).length;
    if (hit === 0) continue;
    const ratio = hit / tokens.length;
    if (ratio >= 0.5) {
      best = Math.max(best, Math.round(ratio * 80) + name.length);
    }
  }
  return best;
}
