import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { hotelTodayKey, toDateKey } from "@/lib/calendar-dates";
import { getHotelCoverCandidates } from "@/lib/hotel-cover";

const HORIZON = 30;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export type OverviewStay = {
  hotelId: string;
  hotelName: string;
  roomTitle: string;
  guestName: string | null;
  start: string;
  end: string;
  channel: "aldeitas" | "airbnb";
};

export type HotelOverview = {
  id: string;
  name: string;
  location: string;
  covers: string[];
  rooms: number;
  inHouse: number;
  arrivalsToday: number;
  departuresToday: number;
  occupancy30: number;
  payout30Cents: number;
  syncedRooms: number;
  gmailConnected: boolean;
  payoutsReady: boolean;
  pendingPayments: number;
};

/** A hotel is "active" once it has a synced room or any booking; the rest are still being set up. */
export const isActiveHotel = (h: HotelOverview) =>
  h.syncedRooms > 0 || h.occupancy30 > 0 || h.inHouse > 0 || h.pendingPayments > 0;

export type AdminOverview = {
  today: string;
  hotels: HotelOverview[];
  arrivals: OverviewStay[];
  departures: OverviewStay[];
};

const USD_TO_MXN = Number(process.env.OWNER_DASHBOARD_USD_MXN || 18.5);
const toMxn = (cents: number, currency: string | null) =>
  !currency || currency === "MXN" ? cents : currency === "USD" ? Math.round(cents * USD_TO_MXN) : 0;

/** Today's arrivals/check-outs and the next 30 days' occupancy for every hotel the user manages. */
export async function loadAdminOverview(userId: string): Promise<AdminOverview> {
  const today = hotelTodayKey();
  const t0 = parseISO(`${today}T00:00:00`);
  const until = addDays(t0, HORIZON);
  const managed = await prisma.hotelManager.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      hotel: {
        select: {
          id: true, name: true, location: true, gmailSyncEnabled: true, gmailSyncEmail: true,
          payoutClabe: true, payoutMercadoPagoEmail: true, mercadoPagoConnectedAt: true,
          coverImageUrl: true, logoImageUrl: true,
          images: { orderBy: { position: "asc" }, select: { url: true } },
          listings: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, title: true, icalUrl: true, _count: { select: { calendarSources: true } },
            },
          },
        },
      },
    },
  });
  const hotels = managed.map((m) => m.hotel);
  const listingIds = hotels.flatMap((h) => h.listings.map((l) => l.id));
  const window = { startDate: { lt: until }, endDate: { gte: addDays(t0, -1) } };
  const [bookings, metas] = await Promise.all([
    prisma.booking.findMany({
      where: { listingId: { in: listingIds }, ...window, status: { in: ["CONFIRMED", "PENDING"] } },
      select: { listingId: true, startDate: true, endDate: true, guestName: true, totalPriceCents: true, currency: true, status: true, authorizedAt: true },
    }),
    prisma.calendarGuestMeta.findMany({
      where: { listingId: { in: listingIds }, ...window, canceledAt: null },
      select: { listingId: true, startDate: true, endDate: true, guestName: true, payoutCents: true, payoutCurrency: true },
    }),
  ]);

  const listingHotel = new Map<string, { hotelId: string; hotelName: string; title: string }>();
  for (const h of hotels) for (const l of h.listings) listingHotel.set(l.id, { hotelId: h.id, hotelName: h.name, title: l.title });

  type Stay = OverviewStay & { listingId: string; cents: number };
  const stays: Stay[] = [];
  const direct = new Set<string>();
  for (const b of bookings) {
    if (b.status === "PENDING" && !b.authorizedAt) continue;
    const key = `${b.listingId}|${dayKey(b.startDate)}|${dayKey(b.endDate)}`;
    direct.add(key);
    const l = listingHotel.get(b.listingId)!;
    stays.push({
      listingId: b.listingId, hotelId: l.hotelId, hotelName: l.hotelName, roomTitle: l.title, guestName: b.guestName,
      start: dayKey(b.startDate), end: dayKey(b.endDate), channel: "aldeitas",
      cents: toMxn(b.totalPriceCents, b.currency),
    });
  }
  for (const m of metas) {
    if (direct.has(`${m.listingId}|${dayKey(m.startDate)}|${dayKey(m.endDate)}`)) continue;
    const l = listingHotel.get(m.listingId)!;
    stays.push({
      listingId: m.listingId, hotelId: l.hotelId, hotelName: l.hotelName, roomTitle: l.title, guestName: m.guestName,
      start: dayKey(m.startDate), end: dayKey(m.endDate), channel: "airbnb",
      cents: toMxn(m.payoutCents ?? 0, m.payoutCurrency),
    });
  }

  // Imported stays can overlap (changed reservations); count each room-night once.
  // Income is spread per night so only nights inside the 30-day window count.
  const nights = new Map<string, Set<string>>();
  const income = new Map<string, number>();
  // Direct bookings first, then the highest nightly rate, so an overlapping import
  // (often unpriced or a changed reservation) never hides known income.
  const perNight = (s: Stay) => s.cents / Math.max(1, differenceInCalendarDays(parseISO(s.end), parseISO(s.start)));
  const rank = (s: Stay) => (s.channel === "aldeitas" ? 1 : 0);
  for (const s of [...stays].sort((a, b) => rank(b) - rank(a) || perNight(b) - perNight(a))) {
    const set = nights.get(s.listingId) ?? new Set<string>();
    const from = parseISO(`${s.start}T00:00:00`);
    const n = differenceInCalendarDays(parseISO(`${s.end}T00:00:00`), from);
    for (let i = 0; i < n; i++) {
      const k = toDateKey(addDays(from, i));
      if (k < today || k >= toDateKey(until) || set.has(k)) continue;
      set.add(k);
      income.set(s.hotelId, (income.get(s.hotelId) ?? 0) + s.cents / n);
    }
    nights.set(s.listingId, set);
  }

  const pending = bookings.filter((b) => b.status === "PENDING" && b.authorizedAt);
  const overview: HotelOverview[] = hotels.map((h) => {
    const mine = stays.filter((s) => s.hotelId === h.id);
    const booked = h.listings.reduce((a, l) => a + (nights.get(l.id)?.size ?? 0), 0);
    return {
      id: h.id,
      name: h.name,
      location: h.location,
      covers: getHotelCoverCandidates(h),
      rooms: h.listings.length,
      inHouse: new Set(mine.filter((s) => s.start <= today && s.end > today).map((s) => s.listingId)).size,
      arrivalsToday: mine.filter((s) => s.start === today).length,
      departuresToday: mine.filter((s) => s.end === today).length,
      occupancy30: h.listings.length ? Math.round((booked / (h.listings.length * HORIZON)) * 100) : 0,
      payout30Cents: Math.round(income.get(h.id) ?? 0),
      syncedRooms: h.listings.filter((l) => l.icalUrl || l._count.calendarSources > 0).length,
      gmailConnected: Boolean(h.gmailSyncEnabled && h.gmailSyncEmail),
      payoutsReady: Boolean(h.mercadoPagoConnectedAt || h.payoutClabe || h.payoutMercadoPagoEmail),
      pendingPayments: pending.filter((b) => listingHotel.get(b.listingId)?.hotelId === h.id).length,
    };
  });

  const strip = ({ listingId: _l, cents: _c, ...s }: Stay): OverviewStay => s;
  const byStart = (a: Stay, b: Stay) => a.start.localeCompare(b.start) || a.hotelName.localeCompare(b.hotelName);
  const weekEnd = toDateKey(addDays(t0, 7));
  return {
    today,
    hotels: overview,
    arrivals: stays.filter((s) => s.start >= today && s.start < weekEnd).sort(byStart).map(strip),
    departures: stays.filter((s) => s.end === today).sort(byStart).map(strip),
  };
}
