import { parseDateKey } from "./calendar-dates";

export type ReservationChangeKind = "canceled" | "altered";

const REQUEST_ONLY = /request|solicitud|pol[ií]tica|policy|wants to|quiere/i;
const CANCELED =
  /\b(?:cancel(?:ed|led|lation)|cancelad[ao]|cancelaci[oó]n|cancel[oó])\b/i;
const ALTERED =
  /reservation change was accepted|cambio (?:en|de) (?:la |tu )?reservaci[oó]n (?:fue )?aceptad|reservation (?:altered|changed|updated|modified)|alteraci[oó]n de la reserva|reserva (?:modificada|cambiada|actualizada)|(?:changes?|cambios?) (?:to|en|a) (?:the |la |tu |your )?reserva/i;

/** Airbnb host emails that change an existing stay (accepted changes only, not requests). */
export function reservationChangeKind(subject: string): ReservationChangeKind | null {
  if (!subject || REQUEST_ONLY.test(subject)) return null;
  if (CANCELED.test(subject)) return "canceled";
  if (ALTERED.test(subject)) return "altered";
  return null;
}

export function normalizeGuestName(name: string | null | undefined) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameFirstName(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeGuestName(a).split(" ")[0];
  const right = normalizeGuestName(b).split(" ")[0];
  return Boolean(left) && left === right;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysApart(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

export type ChangeMetaRow = {
  id: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  guestName: string | null;
  confirmationCode: string | null;
  canceledAt: Date | null;
};

export type ChangeEmailFacts = {
  confirmationCode: string | null;
  guestName: string | null;
  checkIn: Date | null;
  checkOut?: Date | null;
  listingId?: string | null;
};

export type ParsedReservationChange = {
  kind: ReservationChangeKind;
  confirmationCode: string | null;
  guestName: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  airbnbListingId: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic)[a-z]*\\.?";
const NAME = "([A-ZÁÉÍÓÚÑ][\\p{L}'’-]+(?: [A-ZÁÉÍÓÚÑ][\\p{L}'’-]+)?)";
const EN_RANGE = new RegExp(
  `\\b${MONTH}\\s+(\\d{1,2})\\s*[–-]\\s*(?:${MONTH}\\s+)?(\\d{1,2})(?:,\\s*(\\d{4}))?`,
  "gi"
);
const ES_RANGE = new RegExp(
  `\\b(\\d{1,2})\\s+(?:de\\s+)?${MONTH}\\s*[–-]\\s*(\\d{1,2})\\s+(?:de\\s+)?${MONTH}(?:,?\\s*(?:de\\s+)?(\\d{4}))?`,
  "gi"
);

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#\d+;|&zwnj;/g, " ")
    .replace(/\s+/g, " ");
}

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Explicit year wins; otherwise the next occurrence on/after ~45 days before the email. */
function pickYear(month: number, day: number, explicit: number | null, reference: Date) {
  if (explicit) return explicit;
  const year = reference.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  return candidate < reference.getTime() - 45 * DAY_MS ? year + 1 : year;
}

function findStayRange(hay: string, reference: Date) {
  const ranges: Array<{ inM: number; inD: number; outM: number; outD: number; year: number | null }> = [];
  for (const m of hay.matchAll(EN_RANGE)) {
    const inM = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const outM = m[3] ? MONTHS[m[3].slice(0, 3).toLowerCase()] : inM;
    ranges.push({ inM, inD: Number(m[2]), outM, outD: Number(m[4]), year: m[5] ? Number(m[5]) : null });
  }
  for (const m of hay.matchAll(ES_RANGE)) {
    ranges.push({
      inM: MONTHS[m[2].slice(0, 3).toLowerCase()],
      inD: Number(m[1]),
      outM: MONTHS[m[4].slice(0, 3).toLowerCase()],
      outD: Number(m[3]),
      year: m[5] ? Number(m[5]) : null,
    });
  }
  const valid = ranges.filter((r) => r.inM && r.outM && r.inD <= 31 && r.outD <= 31);
  if (!valid.length) return null;
  const first = valid[0];
  const withYear = valid.find(
    (r) => r.year && r.inM === first.inM && r.inD === first.inD && r.outD === first.outD
  );
  const range = withYear || first;
  const inYear = pickYear(range.inM, range.inD, range.year, reference);
  const outYear = range.outM < range.inM ? inYear + 1 : inYear;
  return {
    checkIn: parseDateKey(toKey(inYear, range.inM, range.inD)),
    checkOut: parseDateKey(toKey(outYear, range.outM, range.outD)),
  };
}

function titleCase(name: string) {
  return name
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Facts from an Airbnb cancellation / accepted-change email (subject, text and HTML). */
export function parseReservationChangeEmail(input: {
  subject: string;
  text?: string | null;
  html?: string | null;
  referenceDate?: Date | null;
}): ParsedReservationChange | null {
  const kind = reservationChangeKind(input.subject);
  if (!kind) return null;
  const body = `${input.text || ""}\n${input.html ? htmlToText(input.html) : ""}`;
  const hay = `${input.subject}\n${body}`;
  const reference = input.referenceDate || new Date();

  const code =
    `${hay}\n${input.html || ""}`.match(/\b(HM[A-Z0-9]{8})\b/)?.[1] || null;
  const guestMatch =
    hay.match(new RegExp(`(?:your guest|tu hu[eé]sped)\\s+${NAME}\\s+(?:had to cancel|tuvo que cancelar|canceled|cancel[oó])`, "u")) ||
    hay.match(/\b([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ'’ -]{1,40}?) AGREED TO CHANGE/u) ||
    hay.match(new RegExp(`${NAME}\\s+(?:agreed to change|acept[oó] (?:el|hacer un) cambio)`, "u"));
  const range = findStayRange(hay, reference);
  const listingId =
    `${hay}\n${input.html || ""}`.match(/rooms\/(?:plus\/)?(\d{5,})/)?.[1] ||
    hay.match(/(?:anuncio n[uú]mero|listing #?)\s*(\d{5,})/i)?.[1] ||
    null;

  return {
    kind,
    confirmationCode: code,
    guestName: guestMatch ? titleCase(guestMatch[1].trim()) : null,
    checkIn: range?.checkIn ?? null,
    checkOut: range?.checkOut ?? null,
    airbnbListingId: listingId,
  };
}

/** True when a saved stay and an email describe the same Airbnb reservation. */
export function sameReservation(meta: ChangeMetaRow, facts: ChangeEmailFacts) {
  if (meta.confirmationCode && facts.confirmationCode) {
    return meta.confirmationCode.toUpperCase() === facts.confirmationCode.toUpperCase();
  }
  return sameFirstName(meta.guestName, facts.guestName);
}

/**
 * Stay a cancellation email refers to: same confirmation code, or the only open
 * stay with those dates (and that guest's first name when both are known).
 */
export function findCanceledStay<T extends ChangeMetaRow>(metas: T[], facts: ChangeEmailFacts) {
  const open = metas.filter(
    (meta) => !meta.canceledAt && (!facts.listingId || meta.listingId === facts.listingId)
  );
  if (facts.confirmationCode) {
    const byCode = open.find(
      (meta) =>
        meta.confirmationCode?.toUpperCase() === facts.confirmationCode!.toUpperCase()
    );
    if (byCode) return byCode;
  }
  if (!facts.checkIn || (!facts.guestName && !facts.checkOut)) return null;
  const candidates = open.filter(
    (meta) =>
      !(meta.confirmationCode && facts.confirmationCode) &&
      daysApart(meta.startDate, facts.checkIn!) <= 1 &&
      (!facts.checkOut || daysApart(meta.endDate, facts.checkOut) <= 1) &&
      (!facts.guestName || !meta.guestName || sameFirstName(meta.guestName, facts.guestName))
  );
  return candidates.length === 1 ? candidates[0] : null;
}

/** Saved stay an alteration email moves: same reservation on the listing, within 60 days. */
export function findAlteredStay<T extends ChangeMetaRow>(metas: T[], facts: ChangeEmailFacts) {
  if (!facts.checkIn) return null;
  return (
    metas
      .filter(
        (meta) =>
          !meta.canceledAt &&
          meta.listingId === facts.listingId &&
          daysApart(meta.startDate, facts.checkIn!) <= 60 &&
          sameReservation(meta, facts)
      )
      .sort(
        (a, b) => daysApart(a.startDate, facts.checkIn!) - daysApart(b.startDate, facts.checkIn!)
      )[0] || null
  );
}
