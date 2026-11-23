import type { HotelStats } from "@/lib/hotel-stats";

export type InsightTone = "alert" | "warn" | "good" | "info";

export type HostInsight = {
  id: string;
  tone: InsightTone;
  title: { es: string; en: string };
  body: { es: string; en: string };
  href?: string;
};

function dayOfWeek(todayKey: string, offset: number) {
  const d = new Date(`${todayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.getUTCDay();
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 1–2 free nights boxed in by stays: hard to sell at normal rules. */
export function countOrphanGaps(strip: string) {
  return (strip.match(/(?<=o)f{1,2}(?=o)/g) ?? []).length;
}

/** Plain-language "what's up" cards for the host panel, most urgent first. */
export function buildHostInsights(stats: HotelStats, missingCount = 0): HostInsight[] {
  const out: HostInsight[] = [];
  const k = stats.kpis;
  const today = stats.todayKey;

  if (missingCount > 0) {
    out.push({
      id: "onboarding",
      tone: "alert",
      title: {
        es: `Faltan ${missingCount} datos de tu perfil`,
        en: `${missingCount} profile item${missingCount === 1 ? "" : "s"} missing`,
      },
      body: {
        es: "Sin ellos no podemos sincronizar ni pagarte a tiempo. Ábrelos desde el botón «Completar perfil».",
        en: "Without them we can't sync or pay you on time. Open them from the “Complete profile” button.",
      },
    });
  }

  const arrivalsToday = stats.arrivals.filter((a) => a.checkIn === today).length;
  const departuresToday = stats.departures.filter((d) => d.checkOut === today).length;
  if (arrivalsToday || departuresToday) {
    out.push({
      id: "today",
      tone: "info",
      title: {
        es: `Hoy: ${arrivalsToday} llegada${arrivalsToday === 1 ? "" : "s"}, ${departuresToday} salida${departuresToday === 1 ? "" : "s"}`,
        en: `Today: ${arrivalsToday} arrival${arrivalsToday === 1 ? "" : "s"}, ${departuresToday} check-out${departuresToday === 1 ? "" : "s"}`,
      },
      body: {
        es: departuresToday ? "Confirma que limpieza tenga los cuartos listos antes de las llegadas." : "Revisa que los cuartos estén listos.",
        en: departuresToday ? "Make sure cleaning has rooms ready before arrivals." : "Check the rooms are ready.",
      },
    });
  }

  if (stats.roomCount > 0 && k.occupancyNext7 < 0.4) {
    out.push({
      id: "slow-week",
      tone: "alert",
      title: { es: `Semana floja: ${pct(k.occupancyNext7)} ocupado`, en: `Slow week: ${pct(k.occupancyNext7)} booked` },
      body: {
        es: "Comparte un enlace privado con descuento o baja el precio de estos días.",
        en: "Share a private discounted link or lower prices for these days.",
      },
    });
  }

  const dropped = k.occupancyPast30 - k.occupancyNext30;
  if (dropped > 0.15) {
    out.push({
      id: "pace-drop",
      tone: "warn",
      title: {
        es: `Próximos 30 días: ${pct(k.occupancyNext30)} (antes ${pct(k.occupancyPast30)})`,
        en: `Next 30 days: ${pct(k.occupancyNext30)} (was ${pct(k.occupancyPast30)})`,
      },
      body: {
        es: "Vas por debajo del mes pasado. Revisa precios y fotos de los cuartos más vacíos.",
        en: "You're behind last month. Review prices and photos of the emptiest rooms.",
      },
    });
  }

  const gaps = stats.rooms
    .map((r) => ({ title: r.title, n: countOrphanGaps(r.next30Strip) }))
    .filter((r) => r.n > 0);
  const gapCount = gaps.reduce((s, r) => s + r.n, 0);
  if (gapCount > 0) {
    const names = gaps.slice(0, 3).map((r) => r.title).join(", ");
    out.push({
      id: "orphan-gaps",
      tone: "warn",
      title: {
        es: `${gapCount} hueco${gapCount === 1 ? "" : "s"} de 1–2 noches entre reservas`,
        en: `${gapCount} gap${gapCount === 1 ? "" : "s"} of 1–2 nights between stays`,
      },
      body: {
        es: `${names}. Permite estancias de 1 noche o ofrece esas noches con descuento.`,
        en: `${names}. Allow 1-night stays or offer those nights at a discount.`,
      },
    });
  }

  const emptyRooms = stats.rooms.filter((r) => !r.next30Strip.includes("o"));
  if (emptyRooms.length > 0 && emptyRooms.length < stats.roomCount) {
    const names = emptyRooms.slice(0, 3).map((r) => r.title).join(", ");
    out.push({
      id: "empty-rooms",
      tone: "warn",
      title: {
        es: `${emptyRooms.length} cuarto${emptyRooms.length === 1 ? "" : "s"} sin reservas en 30 días`,
        en: `${emptyRooms.length} room${emptyRooms.length === 1 ? "" : "s"} with no bookings in 30 days`,
      },
      body: {
        es: `${names}. Revisa que su calendario esté sincronizado y su precio sea competitivo.`,
        en: `${names}. Check its calendar is synced and its price is competitive.`,
      },
    });
  }

  let freeWeekendNights = 0;
  for (const room of stats.rooms) {
    for (let i = 0; i < Math.min(14, room.next30Strip.length); i++) {
      const dow = dayOfWeek(today, i);
      if ((dow === 5 || dow === 6) && room.next30Strip[i] === "f") freeWeekendNights++;
    }
  }
  if (freeWeekendNights > 0) {
    out.push({
      id: "weekends",
      tone: "info",
      title: {
        es: `${freeWeekendNights} noche${freeWeekendNights === 1 ? "" : "s"} de fin de semana libres (14 días)`,
        en: `${freeWeekendNights} weekend night${freeWeekendNights === 1 ? "" : "s"} still free (14 days)`,
      },
      body: {
        es: "Viernes y sábado se venden al último. Un enlace privado a clientes anteriores suele llenarlos.",
        en: "Fridays and Saturdays sell last-minute. A private link to past guests usually fills them.",
      },
    });
  }

  if (k.ghostNights > 0) {
    out.push({
      id: "ghosts",
      tone: "warn",
      title: { es: `${k.ghostNights} noches fantasma`, en: `${k.ghostNights} ghost nights` },
      body: {
        es: "Bloqueos que Airbnb ya no tiene. Revísalos en el calendario para no perder ventas.",
        en: "Blocks Airbnb no longer has. Review them in the calendar so you don't lose sales.",
      },
    });
  }

  if (stats.roomCount > 0 && k.occupancyNext30 >= 0.85) {
    out.push({
      id: "raise-prices",
      tone: "good",
      title: { es: `Casi lleno: ${pct(k.occupancyNext30)} en 30 días`, en: `Nearly full: ${pct(k.occupancyNext30)} in 30 days` },
      body: {
        es: "La demanda está alta. Sube el precio de las noches que quedan.",
        en: "Demand is high. Raise prices on the nights left.",
      },
    });
  }

  if (out.length === 0) {
    out.push({
      id: "all-good",
      tone: "good",
      title: { es: "Todo en orden", en: "All good" },
      body: { es: "Nada urgente por ahora.", en: "Nothing urgent right now." },
    });
  }
  const order: Record<InsightTone, number> = { alert: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
