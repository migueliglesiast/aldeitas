export type ParsedAirbnbBookingEmail = {
  guestName: string | null;
  guestCount: number | null;
  checkIn: string | null;
  checkOut: string | null;
  listingHint: string | null;
  airbnbListingId: string | null;
  confirmationCode: string | null;
};

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

/** Best-effort parse of Airbnb reservation confirmation / alteration emails. */
export function parseAirbnbBookingEmail(input: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): ParsedAirbnbBookingEmail | null {
  const subject = input.subject || "";
  const text = [subject, input.text || "", (input.html || "").replace(/<[^>]+>/g, " ")]
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");

  const lowered = text.toLowerCase();
  const looksLikeAirbnb =
    lowered.includes("airbnb") ||
    /reservation (confirmed|accepted|details)|booking confirmed|new booking|huésped|huesped/i.test(
      text
    );
  if (!looksLikeAirbnb) return null;

  const guestName = firstMatch(text, [
    /(?:guest|hu[eé]sped|traveler|traveller)\s*[:\-–]\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-\s]{1,80})/i,
    /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-]+){0,3})\s+is\s+coming/i,
    /reservation\s+confirmed(?:\s+for)?\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'''\-\s]{1,60})/i,
  ]);

  const guestCountRaw = firstMatch(text, [
    /(\d+)\s*(?:guests?|hu[eé]spedes?|huespedes?|adults?|travelers?|travellers?|personas?)\b/i,
    /(?:guests?|hu[eé]spedes?|huespedes?)\s*[:\-–]?\s*(\d+)/i,
  ]);
  const guestCount = guestCountRaw ? Number(guestCountRaw) : null;

  const checkIn = normalizeDate(
    firstMatch(text, [
      /(?:check[-\s]?in|llegada|start date)\s*[:\-–]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{4}-\d{2}-\d{2})\s*(?:to|–|-|through|hasta)/i,
    ])
  );

  const checkOut = normalizeDate(
    firstMatch(text, [
      /(?:check[-\s]?out|salida|end date)\s*[:\-–]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:to|–|-|through|hasta)\s*(\d{4}-\d{2}-\d{2})/i,
    ])
  );

  const airbnbListingId = firstMatch(text, [
    /airbnb\.[a-z.]+\/rooms\/(\d{5,})/i,
    /listing[_/\s-]?id\s*[:\-–]?\s*(\d{5,})/i,
    /\/rooms\/(\d{5,})/i,
  ]);

  const listingHint = firstMatch(text, [
    /(?:listing|propiedad|alojamiento|room)\s*[:\-–]\s*([^\n]{3,120})/i,
    /confirmed for\s+([^\n]{3,120})/i,
  ]);

  const confirmationCode = firstMatch(text, [
    /confirmation\s+code\s*[:\-–]?\s*([A-Z0-9]{8,12})/i,
    /c[oó]digo\s+de\s+confirmaci[oó]n\s*[:\-–]?\s*([A-Z0-9]{8,12})/i,
    /\b(HM[A-Z0-9]{8,})\b/,
  ]);

  if (!guestName && !guestCount && !checkIn && !airbnbListingId && !confirmationCode) {
    return null;
  }

  return {
    guestName: guestName ? guestName.replace(/\s+/g, " ").trim() : null,
    guestCount:
      guestCount != null && Number.isFinite(guestCount) && guestCount > 0
        ? guestCount
        : null,
    checkIn,
    checkOut,
    listingHint: listingHint ? listingHint.replace(/\s+/g, " ").trim() : null,
    airbnbListingId,
    confirmationCode,
  };
}
