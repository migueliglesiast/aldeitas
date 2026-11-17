import { addDays, format, parseISO } from "date-fns";
import {
  fetchAirbnbAvailabilityCalendar,
  fetchAirbnbStayPrice,
  type AirbnbCalendarDay,
} from "@/lib/airbnb-prices";
import { hotelRateFromAirbnbCents } from "@/lib/price-split";

const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000;
const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT = 3;

type Entry<T> = { at: number; value: Promise<T> };
const calendarCache = new Map<string, Entry<AirbnbCalendarDay[] | null>>();
const quoteCache = new Map<string, Entry<number | null>>();

let active = 0;
const queue: Array<() => void> = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => queue.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

function cached<T>(cache: Map<string, Entry<T>>, k: string, ttl: number, load: () => Promise<T>) {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = limited(load).catch(() => null as T);
  cache.set(k, { at: Date.now(), value });
  return value;
}

/** Four months of Airbnb's public calendar for a listing (cached, null on failure). */
export function airbnbCalendar(airbnbId: string) {
  return cached(calendarCache, airbnbId, CALENDAR_TTL_MS, () => fetchAirbnbAvailabilityCalendar(airbnbId, { count: 4 }));
}

/** Hotel-rate nightly price (Airbnb guest price − 16%) for a sample stay, cached. */
export function airbnbQuoteHotelRate(airbnbId: string, checkIn: string, checkOut: string) {
  return cached(quoteCache, `${airbnbId}:${checkIn}:${checkOut}`, QUOTE_TTL_MS, async () => {
    const stay = await fetchAirbnbStayPrice(airbnbId, checkIn, checkOut);
    return stay ? hotelRateFromAirbnbCents(stay.nightlyCents) : null;
  });
}

/**
 * Nights Airbnb shows as unavailable (booked or host-blocked) from `today`, as a per-day boolean list.
 * Long closed stretches (calendar window end, seasonal closures ≥ 45 nights) are `null` so they don't count as demand.
 */
export function unavailableNights(days: AirbnbCalendarDay[], today: string, horizon: number): Array<boolean | null> {
  const byDate = new Map(days.map((d) => [d.date, d.available]));
  const out: Array<boolean | null> = [];
  for (let i = 0; i < horizon; i++) {
    const k = format(addDays(parseISO(`${today}T00:00:00`), i), "yyyy-MM-dd");
    const available = byDate.get(k);
    out.push(available == null ? null : !available);
  }
  let i = 0;
  while (i < out.length) {
    if (out[i] !== true) { i++; continue; }
    let j = i;
    while (j < out.length && out[j] === true) j++;
    if (j - i >= 45 || (j === out.length && j - i >= 21 && i > 0)) for (let x = i; x < j; x++) out[x] = null;
    i = j;
  }
  return out;
}

export function occupancyShare(strip: Array<boolean | null>, from: number, to: number) {
  const slice = strip.slice(from, to).filter((v): v is boolean => v != null);
  return slice.length ? slice.filter(Boolean).length / slice.length : null;
}

export function firstSampleCheckIn(days: AirbnbCalendarDay[], today: string, minAhead = 7) {
  const earliest = format(addDays(parseISO(`${today}T00:00:00`), minAhead), "yyyy-MM-dd");
  const day = days.find((d) => d.date >= earliest && d.availableForCheckin);
  if (!day) return null;
  const nights = Math.max(2, day.minNights || 1);
  return { checkIn: day.date, checkOut: format(addDays(parseISO(`${day.date}T00:00:00`), nights), "yyyy-MM-dd") };
}

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}
