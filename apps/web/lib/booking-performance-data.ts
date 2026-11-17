import { addDays, format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { hotelTodayKey, toDateKey } from "@/lib/calendar-dates";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { GUEST_MARKUP_PERCENT } from "@/lib/price-split";
import {
  buildPerformanceRecs,
  buildPerformanceReport,
  type PerfRoom,
  type PerfStay,
  type Rec,
} from "@/lib/booking-performance";
import {
  airbnbCalendar,
  airbnbQuoteHotelRate,
  firstSampleCheckIn,
  median,
  occupancyShare,
  quantile,
  unavailableNights,
} from "@/lib/airbnb-market";

const AREA_RADIUS_KM = 8;
const HORIZON = 90;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function loadHotelPerformance(hotelId: string) {
  const today = hotelTodayKey();
  const from = addDays(parseISO(`${today}T00:00:00`), -400);
  const hotel = await prisma.hotel.findUniqueOrThrow({
    where: { id: hotelId },
    select: {
      id: true, name: true, location: true, gmailSyncEnabled: true, gmailSyncEmail: true, commissionPercent: true,
      listings: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, title: true, icalUrl: true, airbnbId: true, airbnbUrl: true,
          _count: { select: { calendarSources: true } },
          calendarSources: { select: { icalUrl: true } },
          dailyPrices: { where: { date: { gte: from } }, select: { date: true, priceCents: true } },
        },
      },
    },
  });
  const ids = hotel.listings.map((l) => l.id);
  const titles = new Map(hotel.listings.map((l) => [l.id, l.title]));
  const [bookings, metas, firstImport] = await Promise.all([
    prisma.booking.findMany({ where: { listingId: { in: ids }, endDate: { gte: from } } }),
    prisma.calendarGuestMeta.findMany({ where: { listingId: { in: ids }, endDate: { gte: from } } }),
    prisma.calendarGuestMeta.findFirst({ where: { listingId: { in: ids } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  const rooms: PerfRoom[] = hotel.listings.map((l) => ({
    id: l.id,
    title: l.title,
    rates: Object.fromEntries(l.dailyPrices.map((p) => [dayKey(p.date), p.priceCents])),
  }));

  // The first Gmail sync back-fills old reservations, so their import time says nothing about when they were booked.
  const backfillUntil = firstImport ? firstImport.createdAt.getTime() + 86400000 : 0;
  const mxn = (cents: number | null, currency: string | null) => (currency && currency !== "MXN" ? null : cents);
  const directKeys = new Set(
    bookings.filter((b) => b.status === "CONFIRMED" || (b.status === "PENDING" && b.authorizedAt)).map((b) => `${b.listingId}|${dayKey(b.startDate)}|${dayKey(b.endDate)}`)
  );

  const stays: PerfStay[] = [
    ...bookings.map((b) => ({
      id: b.id, listingId: b.listingId, roomTitle: titles.get(b.listingId) ?? "", channel: "aldeitas" as const,
      bookedAt: toDateKey(b.createdAt), start: dayKey(b.startDate), end: dayKey(b.endDate),
      totalCents: mxn(b.totalPriceCents, b.currency),
      status: b.status === "CONFIRMED" ? ("confirmed" as const) : b.status === "PENDING" && b.authorizedAt ? ("pending" as const) : ("cancelled" as const),
      guestCount: b.guestCount, bookingId: b.id,
    })),
    ...metas.filter((m) => !directKeys.has(`${m.listingId}|${dayKey(m.startDate)}|${dayKey(m.endDate)}`)).map((m) => ({
      id: m.id, listingId: m.listingId, roomTitle: titles.get(m.listingId) ?? "", channel: "airbnb" as const,
      bookedAt: m.createdAt.getTime() < backfillUntil ? null : toDateKey(m.createdAt), start: dayKey(m.startDate), end: dayKey(m.endDate),
      totalCents: mxn(m.payoutCents, m.payoutCurrency),
      status: m.canceledAt ? ("cancelled" as const) : ("confirmed" as const),
      guestCount: m.guestCount, bookingId: null,
    })),
  ];

  stays.push(...(await estimatedAirbnbStays(hotel.listings, stays, today)));

  const report = buildPerformanceReport({ rooms, stays, today, markupPercent: GUEST_MARKUP_PERCENT });
  const calendarsConnected = hotel.listings.some((l) => l.icalUrl || l._count.calendarSources > 0);
  const recs = buildPerformanceRecs(report, {
    gmailConnected: Boolean(hotel.gmailSyncEnabled && hotel.gmailSyncEmail),
    calendarsConnected,
  });
  return { hotel: { id: hotel.id, name: hotel.name, location: hotel.location }, report, recs };
}

type EstListing = { id: string; title: string; airbnbId: string | null; airbnbUrl: string | null; icalUrl: string | null; calendarSources: Array<{ icalUrl: string }> };

// Without Gmail/iCal imports, Airbnb's public calendar is the only view of a room's Airbnb stays:
// each run of unavailable nights becomes one estimated stay (a host block looks the same).
async function estimatedAirbnbStays(listings: EstListing[], known: PerfStay[], today: string): Promise<PerfStay[]> {
  const t0 = parseISO(`${today}T00:00:00`);
  const taken = new Set<string>();
  for (const s of known) {
    if (s.status === "cancelled") continue;
    for (let d = parseISO(`${s.start}T00:00:00`); dayKey(d) < s.end; d = addDays(d, 1)) taken.add(`${s.listingId}|${format(d, "yyyy-MM-dd")}`);
  }
  const perRoom = await Promise.all(listings.map(async (l) => {
    const airbnbId = resolveListingAirbnbId(l);
    const days = airbnbId ? await airbnbCalendar(airbnbId) : null;
    if (!days?.length) return [];
    const strip = unavailableNights(days, today, HORIZON);
    const out: PerfStay[] = [];
    let i = 0;
    while (i < strip.length) {
      const key = (n: number) => format(addDays(t0, n), "yyyy-MM-dd");
      if (strip[i] !== true || taken.has(`${l.id}|${key(i)}`)) { i++; continue; }
      let j = i;
      while (j < strip.length && strip[j] === true && !taken.has(`${l.id}|${key(j)}`)) j++;
      out.push({
        id: `est-${l.id}-${key(i)}`, listingId: l.id, roomTitle: l.title, channel: "airbnb",
        bookedAt: null, start: key(i), end: key(j), totalCents: null, status: "confirmed",
        guestCount: null, bookingId: null, estimated: true,
      });
      i = j;
    }
    return out;
  }));
  return perRoom.flat();
}

export type MarketRoom = { id: string; title: string; strip: Array<boolean | null>; rates: Array<number | null>; occ30: number | null; rate30: number | null };
export type MarketData = {
  today: string;
  rooms: MarketRoom[];
  own: { occ30: number | null; occ60: number | null; occ90: number | null; medianRate: number | null };
  area: { listings: number; hotels: number; occ30: number | null; occ60: number | null; occ90: number | null; medianRate: number | null; p25: number | null; p75: number | null; priced: number };
  months: Array<{ key: string; own: number | null; area: number | null }>;
  recs: Rec[];
};

export async function loadMarket(hotelId: string): Promise<MarketData> {
  const today = hotelTodayKey();
  const t0 = parseISO(`${today}T00:00:00`);
  const in30 = addDays(t0, 30);
  const hotels = await prisma.hotel.findMany({
    select: {
      id: true, latitude: true, longitude: true,
      listings: {
        select: {
          id: true, title: true, airbnbId: true, airbnbUrl: true, icalUrl: true,
          calendarSources: { select: { icalUrl: true } },
          dailyPrices: { where: { date: { gte: t0, lt: addDays(t0, HORIZON) } }, select: { date: true, priceCents: true } },
        },
      },
    },
  });
  const me = hotels.find((h) => h.id === hotelId)!;
  const near = hotels.filter(
    (h) => h.id !== hotelId && me.latitude != null && me.longitude != null && h.latitude != null && h.longitude != null &&
      distanceKm({ lat: me.latitude, lng: me.longitude }, { lat: h.latitude, lng: h.longitude }) <= AREA_RADIUS_KM
  );

  const withStrip = async (l: (typeof me.listings)[number]) => {
    const airbnbId = resolveListingAirbnbId(l);
    const days = airbnbId ? await airbnbCalendar(airbnbId) : null;
    const rateMap = new Map(l.dailyPrices.map((p) => [dayKey(p.date), p.priceCents]));
    const rates = Array.from({ length: HORIZON }, (_, i) => rateMap.get(format(addDays(t0, i), "yyyy-MM-dd")) ?? null);
    const next30 = l.dailyPrices.filter((p) => p.date < in30).map((p) => p.priceCents);
    let rate30 = median(next30);
    if (rate30 == null && airbnbId && days) {
      const sample = firstSampleCheckIn(days, today);
      if (sample) rate30 = await airbnbQuoteHotelRate(airbnbId, sample.checkIn, sample.checkOut);
    }
    const strip = days ? unavailableNights(days, today, HORIZON) : [];
    return { id: l.id, title: l.title, strip, rates, occ30: occupancyShare(strip, 0, 30), rate30 };
  };

  const ownRooms = await Promise.all(me.listings.map(withStrip));
  const areaRooms = (await Promise.all(near.flatMap((h) => h.listings).map(withStrip))).filter((r) => r.strip.length);
  const share = (list: MarketRoom[], a: number, b: number) => {
    const v = list.map((r) => occupancyShare(r.strip, a, b)).filter((x): x is number => x != null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  const ownLive = ownRooms.filter((r) => r.strip.length);
  const areaRates = areaRooms.map((r) => r.rate30).filter((x): x is number => x != null);
  const ownRates = ownRooms.map((r) => r.rate30).filter((x): x is number => x != null);

  const months: MarketData["months"] = [];
  for (let m = 0; m < 3; m++) {
    const first = new Date(t0.getFullYear(), t0.getMonth() + m, 1);
    const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    const a = Math.max(0, Math.round((first.getTime() - t0.getTime()) / 86400000));
    const b = Math.min(HORIZON, Math.round((next.getTime() - t0.getTime()) / 86400000));
    if (b <= a) continue;
    months.push({ key: format(first, "yyyy-MM"), own: share(ownLive, a, b), area: share(areaRooms, a, b) });
  }

  const data: MarketData = {
    today,
    rooms: ownRooms,
    own: { occ30: share(ownLive, 0, 30), occ60: share(ownLive, 0, 60), occ90: share(ownLive, 0, 90), medianRate: median(ownRates) },
    area: {
      listings: areaRooms.length,
      hotels: new Set(near.filter((h) => h.listings.some((l) => areaRooms.some((r) => r.id === l.id))).map((h) => h.id)).size,
      occ30: share(areaRooms, 0, 30), occ60: share(areaRooms, 0, 60), occ90: share(areaRooms, 0, 90),
      medianRate: median(areaRates), p25: quantile(areaRates, 0.25), p75: quantile(areaRates, 0.75), priced: areaRates.length,
    },
    months,
    recs: [],
  };
  data.recs = buildMarketRecs(data);
  return data;
}

export function buildMarketRecs(d: MarketData): Rec[] {
  const recs: Rec[] = [];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const money = (c: number) => `$${Math.round(c / 100).toLocaleString("es-MX")}`;
  const { own, area } = d;
  if (own.occ30 != null && area.occ30 != null) {
    if (own.occ30 + 0.1 < area.occ30) {
      const pricey = own.medianRate != null && area.p75 != null && own.medianRate > area.p75;
      const rate = money(own.medianRate ?? 0);
      const tipEs = pricey
        ? " Tu tarifa (" + rate + ") está en el 25% más caro; bájala un 10–15% en noches libres."
        : " Mejora fotos y título en Airbnb y comparte tu enlace directo.";
      const tipEn = pricey
        ? " Your rate (" + rate + ") is in the priciest 25%; drop it 10–15% on open nights."
        : " Improve Airbnb photos and title and share your direct link.";
      recs.push({ id: "behind", tone: "alert",
        es: ["Vas detrás de la zona", `Próximos 30 días: ${pct(own.occ30)} ocupado vs ${pct(area.occ30)} en la zona.${tipEs}`],
        en: ["Behind the area", `Next 30 days: ${pct(own.occ30)} booked vs ${pct(area.occ30)} in the area.${tipEn}`] });
    } else if (own.occ30 > area.occ30 + 0.1 && own.medianRate != null && area.medianRate != null && own.medianRate <= area.medianRate) {
      recs.push({ id: "raise", tone: "good",
        es: ["Te llenas más rápido que la zona", `${pct(own.occ30)} vs ${pct(area.occ30)} con tarifa igual o menor a la mediana (${money(area.medianRate)}). Puedes subir precios 5–10%.`],
        en: ["You fill faster than the area", `${pct(own.occ30)} vs ${pct(area.occ30)} at or below the area median rate (${money(area.medianRate)}). You can raise prices 5–10%.`] });
    }
  }
  for (const m of d.months) {
    if (m.own != null && m.area != null && m.area - m.own >= 0.2) {
      recs.push({ id: `month-${m.key}`, tone: "warn",
        es: [`${m.key}: la zona se llena y tú no`, `Zona ${pct(m.area)} vs tú ${pct(m.own)}. Revisa precio y estancia mínima de ese mes.`],
        en: [`${m.key}: the area fills, you don't`, `Area ${pct(m.area)} vs you ${pct(m.own)}. Check that month's price and minimum stay.`] });
    }
  }
  return recs;
}
