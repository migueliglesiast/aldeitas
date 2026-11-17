import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export type PerfChannel = "aldeitas" | "airbnb" | "direct";
export type PerfStatus = "confirmed" | "pending" | "cancelled";

export type PerfStay = {
  id: string;
  listingId: string;
  roomTitle: string;
  channel: PerfChannel;
  /** Day the booking was made (yyyy-MM-dd), when known. */
  bookedAt: string | null;
  start: string;
  end: string;
  totalCents: number | null;
  status: PerfStatus;
  guestCount: number | null;
  bookingId: string | null;
  estimated?: boolean;
};

export type PerfRoom = {
  id: string;
  title: string;
  /** Hotel rate per night (cents), keyed by yyyy-MM-dd. */
  rates: Record<string, number>;
};

export type StayRow = PerfStay & {
  nights: number;
  leadDays: number | null;
  paidNightlyCents: number | null;
  usualNightlyCents: number | null;
  deltaPct: number | null;
};

export type Bucket = { label: string; value: number };

export type PerformanceReport = {
  today: string;
  rows: StayRow[];
  kpis: {
    bookingsLast30: number;
    bookingsPrev30: number;
    nightsNext30: number;
    occupancyNext30: number;
    occupancyNext90: number;
    revenueNext90Cents: number;
    avgLeadDays: number | null;
    avgNights: number | null;
    avgDeltaPct: number | null;
  };
  weekly: Bucket[];
  leadTime: Bucket[];
  lengthOfStay: Bucket[];
  months: Array<{ key: string; occupancy: number; avgRateCents: number | null }>;
  channels: Array<{ channel: PerfChannel; nights: number }>;
  weekdayVsWeekend: { weekday: number; weekend: number };
};

const key = (d: Date) => format(d, "yyyy-MM-dd");
const day = (k: string) => parseISO(`${k}T00:00:00`);

export function nightKeys(start: string, end: string) {
  const out: string[] = [];
  for (let d = day(start); key(d) < end; d = addDays(d, 1)) out.push(key(d));
  return out;
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Usual price the guest would have seen: Aldeitas guests pay the hotel rate + markup; Airbnb/direct rows are host payouts compared to the hotel rate. */
export function usualNightly(room: PerfRoom | undefined, nights: string[], channel: PerfChannel, markupPercent: number) {
  if (!room) return null;
  const rates = nights.map((n) => room.rates[n]).filter((v): v is number => typeof v === "number" && v > 0);
  const base = avg(rates);
  if (base == null) return null;
  return Math.round(channel === "aldeitas" ? (base * (100 + markupPercent)) / 100 : base);
}

function bucketize(values: number[], edges: Array<[string, number, number]>): Bucket[] {
  return edges.map(([label, lo, hi]) => ({ label, value: values.filter((v) => v >= lo && v <= hi).length }));
}

export function buildPerformanceReport(input: {
  rooms: PerfRoom[];
  stays: PerfStay[];
  today: string;
  markupPercent: number;
}): PerformanceReport {
  const { rooms, today, markupPercent } = input;
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const roomCount = Math.max(rooms.length, 1);
  const t0 = day(today);

  const rows: StayRow[] = input.stays
    .map((s) => {
      const nights = nightKeys(s.start, s.end);
      const paid = s.totalCents != null && nights.length ? Math.round(s.totalCents / nights.length) : null;
      const usual = usualNightly(roomById.get(s.listingId), nights, s.channel, markupPercent);
      return {
        ...s,
        nights: nights.length,
        leadDays: s.bookedAt ? Math.max(0, differenceInCalendarDays(day(s.start), day(s.bookedAt))) : null,
        paidNightlyCents: paid,
        usualNightlyCents: usual,
        deltaPct: paid != null && usual ? Math.round(((paid - usual) / usual) * 100) : null,
      };
    })
    .sort((a, b) => (b.bookedAt ?? b.start).localeCompare(a.bookedAt ?? a.start));

  const live = rows.filter((r) => r.status !== "cancelled");
  const confirmed = rows.filter((r) => r.status === "confirmed");

  const occupied = new Map<string, Set<string>>();
  for (const r of confirmed) {
    for (const n of nightKeys(r.start, r.end)) {
      if (!occupied.has(n)) occupied.set(n, new Set());
      occupied.get(n)!.add(r.listingId);
    }
  }
  const nightsIn = (from: number, to: number) => {
    let total = 0;
    for (let i = from; i < to; i++) total += occupied.get(key(addDays(t0, i)))?.size ?? 0;
    return total;
  };
  const nightsNext30 = nightsIn(0, 30);

  const bookedBetween = (fromAgo: number, toAgo: number) =>
    live.filter((r) => {
      if (!r.bookedAt) return false;
      const ago = differenceInCalendarDays(t0, day(r.bookedAt));
      return ago >= fromAgo && ago < toAgo;
    }).length;

  let revenueNext90Cents = 0;
  for (const r of confirmed) {
    if (r.paidNightlyCents == null) continue;
    for (const n of nightKeys(r.start, r.end)) {
      const offset = differenceInCalendarDays(day(n), t0);
      if (offset >= 0 && offset < 90) revenueNext90Cents += r.paidNightlyCents;
    }
  }

  const weekly: Bucket[] = [];
  for (let w = 11; w >= 0; w--) {
    const start = addDays(t0, -7 * w - 6);
    weekly.push({ label: format(start, "MM-dd"), value: bookedBetween(7 * w, 7 * w + 7) });
  }

  const leads = live.map((r) => r.leadDays).filter((v): v is number => v != null);
  const losList = live.map((r) => r.nights);

  const months: PerformanceReport["months"] = [];
  for (let m = -2; m <= 3; m++) {
    const first = new Date(t0.getFullYear(), t0.getMonth() + m, 1);
    const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    const days = differenceInCalendarDays(next, first);
    let booked = 0;
    const rates: number[] = [];
    for (let d = first; d < next; d = addDays(d, 1)) {
      const k = key(d);
      booked += occupied.get(k)?.size ?? 0;
      for (const room of rooms) if (room.rates[k]) rates.push(room.rates[k]);
    }
    const a = avg(rates);
    months.push({ key: format(first, "yyyy-MM"), occupancy: booked / (days * roomCount), avgRateCents: a == null ? null : Math.round(a) });
  }

  const channelNights = new Map<PerfChannel, number>();
  for (const r of confirmed) channelNights.set(r.channel, (channelNights.get(r.channel) ?? 0) + r.nights);

  let wkd = 0, wkdN = 0, wke = 0, wkeN = 0;
  for (let i = 0; i < 90; i++) {
    const d = addDays(t0, i);
    const n = occupied.get(key(d))?.size ?? 0;
    if (d.getDay() === 5 || d.getDay() === 6) { wke += n; wkeN += roomCount; } else { wkd += n; wkdN += roomCount; }
  }

  const deltas = live.map((r) => r.deltaPct).filter((v): v is number => v != null);
  const ad = avg(deltas);
  return {
    today,
    rows,
    kpis: {
      bookingsLast30: bookedBetween(0, 30),
      bookingsPrev30: bookedBetween(30, 60),
      nightsNext30,
      occupancyNext30: nightsNext30 / (30 * roomCount),
      occupancyNext90: nightsIn(0, 90) / (90 * roomCount),
      revenueNext90Cents,
      avgLeadDays: leads.length ? Math.round(avg(leads)!) : null,
      avgNights: losList.length ? Math.round(avg(losList)! * 10) / 10 : null,
      avgDeltaPct: ad == null ? null : Math.round(ad),
    },
    weekly,
    leadTime: bucketize(leads, [["0–3", 0, 3], ["4–7", 4, 7], ["8–14", 8, 14], ["15–30", 15, 30], ["31–60", 31, 60], ["60+", 61, Infinity]]),
    lengthOfStay: bucketize(losList, [["1", 1, 1], ["2", 2, 2], ["3–4", 3, 4], ["5–7", 5, 7], ["8+", 8, Infinity]]),
    months,
    channels: [...channelNights.entries()].map(([channel, nights]) => ({ channel, nights })).sort((a, b) => b.nights - a.nights),
    weekdayVsWeekend: { weekday: wkdN ? wkd / wkdN : 0, weekend: wkeN ? wke / wkeN : 0 },
  };
}

export type Rec = { id: string; tone: "alert" | "warn" | "info" | "good"; es: [string, string]; en: [string, string] };

export function buildPerformanceRecs(
  report: PerformanceReport,
  ctx: { gmailConnected: boolean; calendarsConnected: boolean }
): Rec[] {
  const recs: Rec[] = [];
  const k = report.kpis;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  if (!ctx.gmailConnected) {
    recs.push({ id: "gmail", tone: "warn",
      es: ["Conecta el Gmail del hotel", "Así cada reserva de Airbnb entra aquí con fecha de reserva, huésped y pago, y podemos comparar precios y anticipación."],
      en: ["Connect the hotel's Gmail", "Every Airbnb booking then lands here with booking date, guest and payout, so we can compare prices and lead time."] });
  }
  if (!ctx.calendarsConnected) {
    recs.push({ id: "ical", tone: "info",
      es: ["Calendarios de Airbnb no conectados", "La ocupación de Airbnb se estima con su calendario público (reservado o bloqueado se ven igual)."],
      en: ["Airbnb calendars not connected", "Airbnb occupancy is estimated from its public calendar (booked and blocked look the same)."] });
  }
  if (k.bookingsLast30 === 0) {
    recs.push({ id: "nobookings", tone: "alert",
      es: ["Sin reservas registradas en 30 días", "Comparte el enlace directo del hotel con huéspedes anteriores y en redes; en Aldeitas pagan menos que en Airbnb."],
      en: ["No bookings recorded in 30 days", "Share the hotel's direct link with past guests and on social media; guests pay less on Aldeitas than on Airbnb."] });
  } else if (k.bookingsLast30 < k.bookingsPrev30) {
    recs.push({ id: "slower", tone: "warn",
      es: ["Menos reservas que el mes anterior", `${k.bookingsLast30} en los últimos 30 días contra ${k.bookingsPrev30} antes. Revisa precios de las próximas 2 semanas.`],
      en: ["Fewer bookings than last month", `${k.bookingsLast30} in the last 30 days vs ${k.bookingsPrev30} before. Review prices for the next 2 weeks.`] });
  }
  if (k.avgLeadDays != null && k.avgLeadDays <= 7) {
    recs.push({ id: "lastminute", tone: "info",
      es: ["Tus huéspedes reservan a última hora", `Anticipación media de ${k.avgLeadDays} días: deja libres las noches cercanas y usa descuentos de último minuto en vez de bajar todo el mes.`],
      en: ["Your guests book last-minute", `Average lead time ${k.avgLeadDays} days: keep near dates open and use last-minute discounts instead of lowering the whole month.`] });
  } else if (k.avgLeadDays != null && k.avgLeadDays >= 45) {
    recs.push({ id: "early", tone: "info",
      es: ["Reservan con mucha anticipación", `Anticipación media de ${k.avgLeadDays} días: abre el calendario al menos 6 meses y sube precios en fechas que ya se están llenando.`],
      en: ["Guests book far ahead", `Average lead time ${k.avgLeadDays} days: open the calendar at least 6 months out and raise prices on dates that are filling up.`] });
  }
  if (k.avgNights != null && k.avgNights < 3) {
    recs.push({ id: "los", tone: "info",
      es: ["Estancias cortas", `Promedio de ${k.avgNights} noches. Un descuento semanal (7+ noches) suele alargar estancias y bajar limpiezas.`],
      en: ["Short stays", `Average ${k.avgNights} nights. A weekly discount (7+ nights) usually lengthens stays and cuts cleanings.`] });
  }
  if (k.avgDeltaPct != null && k.avgDeltaPct <= -10) {
    recs.push({ id: "below", tone: "warn",
      es: ["Se reserva por debajo de tu precio habitual", `En promedio ${Math.abs(k.avgDeltaPct)}% menos. Revisa descuentos y promociones activas en Airbnb.`],
      en: ["Bookings land below your usual price", `${Math.abs(k.avgDeltaPct)}% below on average. Check active Airbnb discounts and promotions.`] });
  }
  const { weekday, weekend } = report.weekdayVsWeekend;
  if (weekend - weekday >= 0.2) {
    recs.push({ id: "weekday", tone: "info",
      es: ["Entre semana se queda vacío", `Fines de semana ${pct(weekend)} vs entre semana ${pct(weekday)}. Prueba precio más bajo de domingo a jueves.`],
      en: ["Weekdays stay empty", `Weekends ${pct(weekend)} vs weekdays ${pct(weekday)}. Try a lower Sunday–Thursday price.`] });
  }
  if (k.occupancyNext30 >= 0.85) {
    recs.push({ id: "full", tone: "good",
      es: ["Próximos 30 días casi llenos", `${pct(k.occupancyNext30)} ocupado. Sube el precio de las noches que quedan.`],
      en: ["Next 30 days nearly full", `${pct(k.occupancyNext30)} booked. Raise prices on the remaining nights.`] });
  }
  return recs;
}
