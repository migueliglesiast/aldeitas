import type { CalendarSpan, HotelCalendarPayload } from "@/lib/hotel-calendar-data";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";

export type StaySource = NonNullable<CalendarSpan["source"]>;

export type StayRow = {
  roomTitle: string;
  guestName: string;
  guestCount: number | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  source: StaySource;
};

export type HotelStats = {
  todayKey: string;
  currency: "MXN";
  usdToMxn: number;
  roomCount: number;
  kpis: {
    occupancyNext7: number;
    revenueNext7Cents: number;
    occupancyNext30: number;
    occupancyPast30: number;
    revenuePast30Cents: number;
    revenueNext90Cents: number;
    adrCents: number | null;
    revparNext30Cents: number;
    avgStayNights: number | null;
    blockedNightsNext30: number;
    ghostNights: number;
  };
  timeline: Array<{ day: string; occupied: number; pct: number }>;
  next7: Array<{
    day: string;
    occupied: number;
    pct: number;
    revenueCents: number;
    checkouts: number;
  }>;
  revenueBySource: Array<{ source: StaySource; past30Cents: number; next90Cents: number }>;
  payoutCoverage: { withPayout: number; total: number };
  months: Array<{ month: string; occupancy: number; revenueCents: number }>;
  sources: Array<{ source: StaySource; nights: number }>;
  rooms: Array<{
    id: string;
    title: string;
    occupancyPast30: number;
    occupancyNext30: number;
    nightsNext90: number;
    revenueNext90Cents: number;
    listedRateCents: number | null;
    /** Next 30 nights: "o" occupied, "b" blocked, "g" ghost, "f" free. */
    next30Strip: string;
  }>;
  arrivals: StayRow[];
  departures: StayRow[];
};

const OCCUPYING = new Set<StaySource>(["aldeitas", "airbnb", "vrbo"]);

function addDays(key: string, n: number) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function nightsBetween(startKey: string, endKey: string) {
  return Math.round(
    (parseDateKey(endKey).getTime() - parseDateKey(startKey).getTime()) / 86_400_000
  );
}

function spanSource(span: CalendarSpan): StaySource {
  if (span.source) return span.source;
  if (span.kind === "booking") return "aldeitas";
  if (span.kind === "manual_block") return "blocked";
  if (span.kind === "ghost") return "ghost";
  return "airbnb";
}

function toMxnCents(cents: number, currency: string | null | undefined, usdToMxn: number) {
  return (currency || "MXN").toUpperCase() === "USD" ? Math.round(cents * usdToMxn) : cents;
}

const pct = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/**
 * Owner statistics from a calendar payload whose window starts in the past.
 * A night is occupied when an Aldeitas, Airbnb or Vrbo stay covers it; host
 * blocks and ghost bookings are reported separately. Payouts are spread
 * evenly over each stay's nights; USD payouts are converted at `usdToMxn`.
 */
export function computeHotelStats(
  payload: HotelCalendarPayload,
  todayKey: string,
  usdToMxn: number
): HotelStats {
  const days = payload.days;
  const roomCount = payload.rooms.length;
  const past30 = new Set(days.filter((d) => d < todayKey && d >= addDays(todayKey, -30)));
  const next30 = new Set(days.filter((d) => d >= todayKey && d < addDays(todayKey, 30)));
  const next90 = new Set(days.filter((d) => d >= todayKey && d < addDays(todayKey, 90)));
  const timelineDays = days.filter((d) => d >= addDays(todayKey, -30) && d < addDays(todayKey, 60));

  const occupiedByDay = new Map<string, number>();
  const sourceNights = new Map<StaySource, number>();
  const monthAgg = new Map<string, { occupied: number; days: number; revenue: number }>();
  let revenuePast30 = 0;
  let revenueNext90 = 0;
  let revenueNext30 = 0;
  const revenueByDay = new Map<string, number>();
  const sourceRevenue = new Map<StaySource, { past30: number; next90: number }>();
  let staysTotal = 0;
  let staysWithPayout = 0;
  let paidNights = 0;
  let paidRevenue = 0;
  let blockedNext30 = 0;
  let ghostNights = 0;
  const stayLengths: number[] = [];
  const arrivals: StayRow[] = [];
  const departures: StayRow[] = [];
  const week = addDays(todayKey, 7);

  const rooms = payload.rooms.map((room) => {
    const occupiedNights = new Set<string>();
    const blockedNights = new Set<string>();
    const ghostNightSet = new Set<string>();
    let roomRevenue90 = 0;

    for (const span of room.spans) {
      const source = spanSource(span);
      const stayNights = Math.max(1, nightsBetween(span.rangeStartDay, span.checkoutDay));
      const nights: string[] = [];
      for (let d = span.startDay; d <= span.endDay; d = addDays(d, 1)) nights.push(d);

      if (source === "ghost") {
        nights.forEach((d) => ghostNightSet.add(d));
        ghostNights += nights.filter((d) => next90.has(d)).length;
        continue;
      }
      if (source === "blocked") {
        nights.forEach((d) => blockedNights.add(d));
        blockedNext30 += nights.filter((d) => next30.has(d)).length;
        continue;
      }
      if (!OCCUPYING.has(source)) continue;

      const inWindow = nights.some((d) => past30.has(d) || next90.has(d));
      if (inWindow) {
        staysTotal += 1;
        if (span.payoutCents != null) staysWithPayout += 1;
      }

      const perNight =
        span.payoutCents != null
          ? toMxnCents(span.payoutCents, span.payoutCurrency, usdToMxn) / stayNights
          : null;

      for (const night of nights) {
        if (occupiedNights.has(night)) continue;
        occupiedNights.add(night);
        if (next90.has(night)) {
          sourceNights.set(source, (sourceNights.get(source) || 0) + 1);
        }
        if (perNight != null) {
          revenueByDay.set(night, (revenueByDay.get(night) || 0) + perNight);
          const bySource = sourceRevenue.get(source) || { past30: 0, next90: 0 };
          if (past30.has(night)) bySource.past30 += perNight;
          if (next90.has(night)) bySource.next90 += perNight;
          sourceRevenue.set(source, bySource);
          if (past30.has(night)) revenuePast30 += perNight;
          if (next30.has(night)) revenueNext30 += perNight;
          if (next90.has(night)) {
            revenueNext90 += perNight;
            roomRevenue90 += perNight;
          }
          if (past30.has(night) || next90.has(night)) {
            paidNights += 1;
            paidRevenue += perNight;
          }
        }
      }

      if (span.rangeStartDay >= addDays(todayKey, -30) && span.rangeStartDay < addDays(todayKey, 90)) {
        stayLengths.push(stayNights);
      }
      const row: StayRow = {
        roomTitle: room.title,
        guestName: span.guestName || "",
        guestCount: span.guestCount ?? null,
        checkIn: span.rangeStartDay,
        checkOut: span.checkoutDay,
        nights: stayNights,
        source,
      };
      if (span.rangeStartDay >= todayKey && span.rangeStartDay < week) arrivals.push(row);
      if (span.checkoutDay >= todayKey && span.checkoutDay < week) departures.push(row);
    }

    for (const night of occupiedNights) {
      occupiedByDay.set(night, (occupiedByDay.get(night) || 0) + 1);
    }

    const listed = [...next30]
      .map((d) => room.cells[d])
      .filter((c) => c && c.status === "available" && c.priceCents > 0)
      .map((c) => c.priceCents);

    return {
      id: room.id,
      title: room.title,
      occupancyPast30: pct([...past30].filter((d) => occupiedNights.has(d)).length, past30.size),
      occupancyNext30: pct([...next30].filter((d) => occupiedNights.has(d)).length, next30.size),
      nightsNext90: [...next90].filter((d) => occupiedNights.has(d)).length,
      revenueNext90Cents: Math.round(roomRevenue90),
      next30Strip: [...next30]
        .sort()
        .map((d) =>
          occupiedNights.has(d) ? "o" : blockedNights.has(d) ? "b" : ghostNightSet.has(d) ? "g" : "f"
        )
        .join(""),
      listedRateCents: listed.length
        ? Math.round(listed.reduce((a, b) => a + b, 0) / listed.length)
        : null,
    };
  });

  for (const day of next90) {
    const month = day.slice(0, 7);
    const agg = monthAgg.get(month) || { occupied: 0, days: 0, revenue: 0 };
    agg.occupied += occupiedByDay.get(day) || 0;
    agg.days += roomCount;
    monthAgg.set(month, agg);
  }
  for (const room of payload.rooms) {
    for (const span of room.spans) {
      const source = spanSource(span);
      if (!OCCUPYING.has(source) || span.payoutCents == null) continue;
      const stayNights = Math.max(1, nightsBetween(span.rangeStartDay, span.checkoutDay));
      const perNight = toMxnCents(span.payoutCents, span.payoutCurrency, usdToMxn) / stayNights;
      for (let d = span.startDay; d <= span.endDay; d = addDays(d, 1)) {
        const agg = next90.has(d) ? monthAgg.get(d.slice(0, 7)) : undefined;
        if (agg) agg.revenue += perNight;
      }
    }
  }

  const occupiedIn = (set: Set<string>) =>
    [...set].reduce((sum, d) => sum + (occupiedByDay.get(d) || 0), 0);
  const byDate = (a: StayRow, b: StayRow) => a.checkIn.localeCompare(b.checkIn);
  const next7Days = days.filter((d) => d >= todayKey && d < week);
  const next7 = next7Days.map((day) => ({
    day,
    occupied: occupiedByDay.get(day) || 0,
    pct: pct(occupiedByDay.get(day) || 0, roomCount),
    revenueCents: Math.round(revenueByDay.get(day) || 0),
    checkouts: departures.filter((row) => row.checkOut === day).length,
  }));

  return {
    todayKey,
    currency: "MXN",
    usdToMxn,
    roomCount,
    kpis: {
      occupancyNext7: pct(
        next7.reduce((sum, d) => sum + d.occupied, 0),
        next7.length * roomCount
      ),
      revenueNext7Cents: next7.reduce((sum, d) => sum + d.revenueCents, 0),
      occupancyNext30: pct(occupiedIn(next30), next30.size * roomCount),
      occupancyPast30: pct(occupiedIn(past30), past30.size * roomCount),
      revenuePast30Cents: Math.round(revenuePast30),
      revenueNext90Cents: Math.round(revenueNext90),
      adrCents: paidNights ? Math.round(paidRevenue / paidNights) : null,
      revparNext30Cents: Math.round(pct(revenueNext30, next30.size * roomCount)),
      avgStayNights: stayLengths.length
        ? Math.round((stayLengths.reduce((a, b) => a + b, 0) / stayLengths.length) * 10) / 10
        : null,
      blockedNightsNext30: blockedNext30,
      ghostNights,
    },
    timeline: timelineDays.map((day) => ({
      day,
      occupied: occupiedByDay.get(day) || 0,
      pct: pct(occupiedByDay.get(day) || 0, roomCount),
    })),
    next7,
    revenueBySource: (["airbnb", "aldeitas", "vrbo"] as StaySource[])
      .map((source) => {
        const r = sourceRevenue.get(source) || { past30: 0, next90: 0 };
        return {
          source,
          past30Cents: Math.round(r.past30),
          next90Cents: Math.round(r.next90),
        };
      })
      .filter((r) => r.past30Cents > 0 || r.next90Cents > 0),
    payoutCoverage: { withPayout: staysWithPayout, total: staysTotal },
    months: [...monthAgg.entries()].map(([month, agg]) => ({
      month,
      occupancy: pct(agg.occupied, agg.days),
      revenueCents: Math.round(agg.revenue),
    })),
    sources: (["airbnb", "aldeitas", "vrbo"] as StaySource[])
      .map((source) => ({ source, nights: sourceNights.get(source) || 0 }))
      .filter((row) => row.nights > 0),
    rooms,
    arrivals: arrivals.sort(byDate),
    departures: departures.sort((a, b) => a.checkOut.localeCompare(b.checkOut)),
  };
}

/** Same stats with every money figure zeroed, for links shared with staff. */
export function toPublicStats(stats: HotelStats): HotelStats {
  return {
    ...stats,
    kpis: {
      ...stats.kpis,
      revenuePast30Cents: 0,
      revenueNext90Cents: 0,
      revenueNext7Cents: 0,
      adrCents: null,
      revparNext30Cents: 0,
    },
    next7: stats.next7.map((d) => ({ ...d, revenueCents: 0 })),
    months: stats.months.map((m) => ({ ...m, revenueCents: 0 })),
    rooms: stats.rooms.map((r) => ({ ...r, revenueNext90Cents: 0, listedRateCents: null })),
    revenueBySource: [],
    payoutCoverage: { withPayout: 0, total: 0 },
  };
}
