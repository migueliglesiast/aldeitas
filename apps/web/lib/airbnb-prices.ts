import axios from "axios";
import { addDays, format, parseISO } from "date-fns";
import { SITE_CURRENCY } from "@/lib/currency";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";

const AIRBNB_API_KEY =
  process.env.AIRBNB_API_KEY || "d306zoyjsyarp7ifhu67rjxn52tv0t20";

/** Working persisted-query hash used by public Airbnb clients (may rotate). */
const STAYS_PDP_SECTIONS_HASH =
  process.env.AIRBNB_STAYS_PDP_HASH ||
  "80c7889b4b0027d99ffea830f6c0d4911a6e863a957cbe1044823f0fc746bf1f";

const AVAILABILITY_CALENDAR_HASH =
  process.env.AIRBNB_AVAILABILITY_HASH ||
  "8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade";

export type AirbnbCalendarDay = {
  date: string;
  available: boolean;
  availableForCheckin: boolean;
  minNights: number;
};

export type AirbnbStayPrice = {
  nightlyCents: number;
  nights: number;
  currency: string;
  accommodationTotalCents: number;
};

function encodeRoomId(roomId: string, prefix: string) {
  return Buffer.from(`${prefix}:${roomId}`).toString("base64");
}

function airbnbHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Airbnb-Api-Key": AIRBNB_API_KEY,
  };
}

function parseMoneyToCents(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\u00a0/g, " ")
    .replace(/[^\d.,]/g, "")
    .trim();
  if (!cleaned) return null;

  // Airbnb MXN often uses "$1,337.17" (comma thousands, dot decimal)
  // or "$1.337,17" in some locales — prefer the last separator as decimal when both exist.
  let normalized = cleaned;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // "$3157" style with thousand commas only, or decimal comma
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0].replace(/\./g, "")}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function extractNightlyFromPriceDetails(priceDetails: any[]): AirbnbStayPrice | null {
  for (const group of priceDetails || []) {
    for (const item of group?.items || []) {
      const description = String(item?.description || "");
      const nightMatch = description.match(
        /(\d+)\s*(?:noches?|nights?)\s*[x×]\s*\$?\s*([\d.,]+)/i
      );
      if (!nightMatch) continue;
      const nights = Number(nightMatch[1]);
      const nightlyCents = parseMoneyToCents(nightMatch[2]);
      const accommodationTotalCents =
        parseMoneyToCents(item?.priceString) ??
        (nightlyCents != null && nights > 0 ? nightlyCents * nights : null);
      if (!nightlyCents || !nights || !accommodationTotalCents) continue;
      return {
        nightlyCents,
        nights,
        currency: SITE_CURRENCY,
        accommodationTotalCents,
      };
    }
  }
  return null;
}

export async function fetchAirbnbAvailabilityCalendar(
  listingId: string,
  options: { month?: number; year?: number; count?: number; currency?: string } = {}
): Promise<AirbnbCalendarDay[]> {
  const now = new Date();
  const month = options.month ?? now.getUTCMonth() + 1;
  const year = options.year ?? now.getUTCFullYear();
  const count = options.count ?? 3;
  const currency = options.currency ?? SITE_CURRENCY;

  const variables = JSON.stringify({
    request: { count, listingId, month, year },
  });
  const extensions = JSON.stringify({
    persistedQuery: { version: 1, sha256Hash: AVAILABILITY_CALENDAR_HASH },
  });
  const params = new URLSearchParams({
    operationName: "PdpAvailabilityCalendar",
    locale: "es-MX",
    currency,
    variables,
    extensions,
  });
  const url = `https://www.airbnb.mx/api/v3/PdpAvailabilityCalendar/${AVAILABILITY_CALENDAR_HASH}?${params}`;
  const res = await axios.get(url, {
    headers: airbnbHeaders(),
    timeout: 20000,
  });

  const months =
    res.data?.data?.merlin?.pdpAvailabilityCalendar?.calendarMonths || [];
  const days: AirbnbCalendarDay[] = [];
  for (const calendarMonth of months) {
    for (const day of calendarMonth.days || []) {
      days.push({
        date: day.calendarDate,
        available: Boolean(day.available),
        availableForCheckin: Boolean(day.availableForCheckin),
        minNights: Number(day.minNights) || 1,
      });
    }
  }
  return days;
}

export async function fetchAirbnbStayPrice(
  listingId: string,
  checkIn: string,
  checkOut: string,
  options: { currency?: string; adults?: number } = {}
): Promise<AirbnbStayPrice | null> {
  const currency = options.currency ?? SITE_CURRENCY;
  const adults = String(options.adults ?? 1);

  const variables = {
    id: encodeRoomId(listingId, "StayListing"),
    demandStayListingId: encodeRoomId(listingId, "DemandStayListing"),
    pdpSectionsRequest: {
      adults,
      bypassTargetings: false,
      categoryTag: null,
      causeId: null,
      children: null,
      disasterId: null,
      discountedGuestFeeVersion: null,
      displayExtensions: null,
      federatedSearchId: null,
      forceBoostPriorityMessageType: null,
      infants: null,
      interactionType: null,
      layouts: ["SIDEBAR", "SINGLE_COLUMN"],
      pets: 0,
      pdpTypeOverride: null,
      photoId: null,
      preview: false,
      previousStateCheckIn: null,
      previousStateCheckOut: null,
      priceDropSource: null,
      privateBooking: false,
      promotionUuid: null,
      relaxedAmenityIds: null,
      searchId: null,
      selectedCancellationPolicyId: null,
      selectedRatePlanId: null,
      splitStays: null,
      staysBookingMigrationEnabled: false,
      translateUgc: null,
      useNewSectionWrapperApi: false,
      sectionIds: ["BOOK_IT_SIDEBAR", "BOOK_IT_FLOATING_FOOTER"],
      checkIn,
      checkOut,
    },
  };

  const extensions = {
    persistedQuery: { version: 1, sha256Hash: STAYS_PDP_SECTIONS_HASH },
  };
  const params = new URLSearchParams({
    operationName: "StaysPdpSections",
    locale: "es-MX",
    currency,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });
  const url = `https://www.airbnb.mx/api/v3/StaysPdpSections/${STAYS_PDP_SECTIONS_HASH}?${params}`;

  try {
    const res = await axios.get(url, {
      headers: airbnbHeaders(),
      timeout: 20000,
    });
    if (res.data?.errors?.length) return null;

    const sections =
      res.data?.data?.presentation?.stayProductDetailPage?.sections?.sections ||
      [];
    for (const section of sections) {
      const priceDetails =
        section?.section?.structuredDisplayPrice?.explanationData?.priceDetails;
      const parsed = extractNightlyFromPriceDetails(priceDetails || []);
      if (parsed) return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function addDaysKey(dateKey: string, days: number) {
  return format(addDays(parseISO(`${dateKey}T00:00:00`), days), "yyyy-MM-dd");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pull Airbnb nightly rates for the next N months into a date → cents map.
 * Samples bookable check-in dates (stepped) to stay within reasonable request volume.
 */
export async function fetchAirbnbDailyPriceMap(
  listingId: string,
  options: {
    months?: number;
    currency?: string;
    /** Sample every Nth bookable check-in to reduce API calls. Default 1 = all. */
    sampleEvery?: number;
    delayMs?: number;
  } = {}
): Promise<{ prices: Map<string, number>; samples: number; errors: number }> {
  const months = options.months ?? 3;
  const currency = options.currency ?? SITE_CURRENCY;
  const sampleEvery = Math.max(1, options.sampleEvery ?? 2);
  const delayMs = options.delayMs ?? 350;

  const now = new Date();
  const calendarDays = await fetchAirbnbAvailabilityCalendar(listingId, {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
    count: months,
    currency,
  });

  const checkIns = calendarDays.filter((day) => day.availableForCheckin);
  const prices = new Map<string, number>();
  let samples = 0;
  let errors = 0;

  for (let i = 0; i < checkIns.length; i += sampleEvery) {
    const day = checkIns[i];
    const nights = Math.max(1, day.minNights || 1);
    const checkOut = addDaysKey(day.date, nights);
    const stay = await fetchAirbnbStayPrice(listingId, day.date, checkOut, {
      currency,
    });
    samples += 1;
    if (!stay) {
      errors += 1;
      await sleep(delayMs);
      continue;
    }

    for (let n = 0; n < nights; n += 1) {
      const nightKey = addDaysKey(day.date, n);
      if (!prices.has(nightKey)) {
        prices.set(nightKey, stay.nightlyCents);
      }
    }

    // Fill gaps until the next sampled check-in with the last known nightly.
    const next = checkIns[i + sampleEvery];
    if (next) {
      let cursor = addDaysKey(day.date, nights);
      while (cursor < next.date) {
        if (!prices.has(cursor)) prices.set(cursor, stay.nightlyCents);
        cursor = addDaysKey(cursor, 1);
      }
    }

    await sleep(delayMs);
  }

  return { prices, samples, errors };
}

export async function fetchAirbnbNightlyForStay(
  listing: {
    airbnbId?: string | null;
    airbnbUrl?: string | null;
    icalUrl?: string | null;
    calendarSources?: Array<{ icalUrl: string }>;
  },
  checkIn: string,
  checkOut: string
): Promise<{ nightlyCents: number; currency: string } | null> {
  const listingId = resolveListingAirbnbId(listing);
  if (!listingId) return null;
  const stay = await fetchAirbnbStayPrice(listingId, checkIn, checkOut);
  if (!stay) return null;
  return { nightlyCents: stay.nightlyCents, currency: stay.currency };
}
