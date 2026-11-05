"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { HotelStats, StaySource } from "@/lib/hotel-stats";
import type { HostInsight, InsightTone } from "@/lib/host-insights";

export type PanelSpan = {
  id: string;
  start: number;
  end: number;
  kind: "booking" | "external" | "manual_block" | "ghost";
  source: StaySource;
  label: string;
  guestCount: number | null;
  bookingId: string | null;
  startsBefore: boolean;
  endsAfter: boolean;
};

export type PanelRoom = {
  id: string;
  title: string;
  hotelId: string;
  /** Hotel rate per visible day, cents; null when the night is taken. */
  prices: Array<number | null>;
  spans: PanelSpan[];
};

export type PanelHotel = { id: string; name: string; rooms: PanelRoom[] };

const noopSubscribe = () => () => {};

const COPY = {
  es: {
    calendar: "Calendario de todas las reservas",
    calendarNote: "3 semanas · toca un cuarto para editar precios y bloqueos",
    openFull: "Calendario completo",
    today: "Hoy",
    whatsUp: "Qué está pasando",
    occupancy30: "Ocupación 30 días",
    vsPast: (v: string) => `antes ${v}`,
    revenuePast30: "Ingresos 30 días",
    onBooks90: "Reservado 90 días",
    adr: "Tarifa media",
    pace: "Ocupación diaria · próximos 30 días",
    channels: "De dónde vienen",
    months: "Ocupación por mes",
    next7: "Próximos 7 días",
    arrivals: "Llegadas",
    departures: "Salidas",
    none: "Ninguna",
    rooms: "Cuartos · próximos 30 días",
    nights: "noches",
    noRooms: "Aún no hay cuartos. Agrega tus anuncios de Airbnb para ver el panel.",
    legend: { aldeitas: "Aldeitas", airbnb: "Airbnb", vrbo: "Vrbo", blocked: "Bloqueado", ghost: "Fantasma" },
    guests: (n: number) => `${n} huésp.`,
  },
  en: {
    calendar: "All reservations calendar",
    calendarNote: "3 weeks · tap a room to edit prices and blocks",
    openFull: "Full calendar",
    today: "Today",
    whatsUp: "What's up",
    occupancy30: "Occupancy 30 days",
    vsPast: (v: string) => `was ${v}`,
    revenuePast30: "Revenue 30 days",
    onBooks90: "On the books 90 days",
    adr: "Avg. nightly rate",
    pace: "Daily occupancy · next 30 days",
    channels: "Where bookings come from",
    months: "Occupancy by month",
    next7: "Next 7 days",
    arrivals: "Arrivals",
    departures: "Check-outs",
    none: "None",
    rooms: "Rooms · next 30 days",
    nights: "nights",
    noRooms: "No rooms yet. Add your Airbnb listings to see the panel.",
    legend: { aldeitas: "Aldeitas", airbnb: "Airbnb", vrbo: "Vrbo", blocked: "Blocked", ghost: "Ghost" },
    guests: (n: number) => `${n} guests`,
  },
};

const SOURCE_BAR: Record<StaySource, string> = {
  aldeitas: "bg-aldeitas text-white",
  airbnb: "bg-[#FF5A5F] text-white",
  vrbo: "bg-[#245ABC] text-white",
  blocked: "bg-slate-300 text-slate-700",
  ghost: "border border-dashed border-slate-400 bg-white text-slate-500",
};

const SOURCE_DOT: Record<StaySource, string> = {
  aldeitas: "bg-aldeitas",
  airbnb: "bg-[#FF5A5F]",
  vrbo: "bg-[#245ABC]",
  blocked: "bg-slate-300",
  ghost: "border border-dashed border-slate-400 bg-white",
};

const TONE: Record<InsightTone, { ring: string; dot: string }> = {
  alert: { ring: "border-rose-200 bg-rose-50", dot: "bg-rose-500" },
  warn: { ring: "border-amber-200 bg-amber-50", dot: "bg-amber-500" },
  info: { ring: "border-sky-200 bg-sky-50", dot: "bg-sky-500" },
  good: { ring: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500" },
};

const STRIP_CLASS: Record<string, string> = {
  o: "bg-aldeitas",
  b: "bg-slate-300",
  g: "bg-slate-200",
  f: "bg-slate-100",
};

const percent = (v: number) => `${Math.round(v * 100)}%`;

function money(cents: number) {
  const amount = Math.round(cents / 100);
  if (amount <= 0) return "—";
  return `$${amount.toLocaleString("es-MX")}`;
}

function compact(cents: number) {
  const a = cents / 100;
  if (a < 1000) return `${Math.round(a)}`;
  return `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
}

function dayParts(key: string, locale: string) {
  const d = new Date(`${key}T00:00:00`);
  const loc = locale === "es" ? "es-MX" : "en-US";
  return {
    dow: d.toLocaleDateString(loc, { weekday: "narrow" }),
    day: d.getDate(),
    weekend: d.getDay() === 5 || d.getDay() === 6,
    month: d.toLocaleDateString(loc, { month: "short" }),
  };
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-black/[0.07] bg-white p-4 ${className}`}>{children}</section>;
}

function Kpi({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-3">
      <p className="text-[11px] leading-tight text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-heading">{value}</p>
      {sub ? (
        <p className={`mt-0.5 text-[11px] ${trend === undefined ? "text-muted" : trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend === undefined ? "" : trend >= 0 ? "▲ " : "▼ "}
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function PaceChart({ stats, todayLabel }: { stats: HotelStats; todayLabel: string }) {
  const points = stats.timeline.filter((p) => p.day >= stats.todayKey).slice(0, 30);
  const w = 300;
  const h = 90;
  const bw = w / Math.max(points.length, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="h-auto w-full" role="img" aria-label="Occupancy next 30 days">
      <line x1={0} x2={w} y1={h * 0.5} y2={h * 0.5} stroke="#000" strokeOpacity={0.06} />
      {points.map((p, i) => {
        const bh = Math.max(p.pct * h, p.pct > 0 ? 2 : 0);
        const tone = p.pct >= 0.75 ? "#0092A1" : p.pct >= 0.4 ? "#5FB8C1" : "#F2A65A";
        return <rect key={p.day} x={i * bw + 1} y={h - bh} width={Math.max(bw - 2, 1)} height={bh} rx={1.5} fill={tone} />;
      })}
      <rect x={0} y={0} width={Math.max(bw - 1, 1)} height={h} fill="none" stroke="#0092A1" strokeWidth={1} strokeDasharray="2 2" />
      <text x={2} y={h + 11} fontSize={9} fill="#78736B">
        {todayLabel}
      </text>
      <text x={w - 2} y={h + 11} fontSize={9} fill="#78736B" textAnchor="end">
        +30
      </text>
    </svg>
  );
}

function ChannelBar({ stats, labels }: { stats: HotelStats; labels: Record<StaySource, string> }) {
  const rows = stats.sources.filter((s) => s.nights > 0);
  const total = rows.reduce((s, r) => s + r.nights, 0);
  if (total === 0) return <p className="text-xs text-muted">—</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {rows.map((r) => (
          <div key={r.source} className={SOURCE_DOT[r.source]} style={{ width: `${(r.nights / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.source} className="flex items-center gap-1.5 text-ink">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SOURCE_DOT[r.source]}`} />
            <span className="truncate">{labels[r.source]}</span>
            <span className="ml-auto tabular-nums text-muted">{percent(r.nights / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthBars({ stats, locale }: { stats: HotelStats; locale: string }) {
  const months = stats.months.slice(0, 4);
  return (
    <div className="flex items-end gap-2">
      {months.map((m) => (
        <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[11px] font-semibold tabular-nums text-heading">{percent(m.occupancy)}</span>
          <div className="flex h-16 w-full items-end rounded-md bg-slate-100">
            <div className="w-full rounded-md bg-aldeitas/80" style={{ height: `${Math.max(m.occupancy * 100, 2)}%` }} />
          </div>
          <span className="text-[10px] capitalize text-muted">
            {new Date(`${m.month}-01T00:00:00`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { month: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function PortfolioCalendar({
  hotels,
  days,
  todayKey,
  locale,
  t,
}: {
  hotels: PanelHotel[];
  days: string[];
  todayKey: string;
  locale: string;
  t: (typeof COPY)["es"];
}) {
  const cols = `minmax(7.5rem,10rem) repeat(${days.length}, minmax(2.1rem, 1fr))`;
  const todayIndex = days.indexOf(todayKey);
  const multi = hotels.length > 1;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[46rem]">
        <div className="grid border-b border-black/[0.06] pb-1" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((key, i) => {
            const p = dayParts(key, locale);
            return (
              <div
                key={key}
                className={`flex flex-col items-center text-[10px] leading-tight ${
                  i === todayIndex ? "font-bold text-aldeitas" : p.weekend ? "text-heading" : "text-muted"
                }`}
              >
                <span className="uppercase">{p.dow}</span>
                <span className="text-xs tabular-nums">{p.day}</span>
              </div>
            );
          })}
        </div>
        {hotels.map((hotel) => (
          <div key={hotel.id}>
            {multi ? (
              <div className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{hotel.name}</div>
            ) : null}
            {hotel.rooms.map((room) => (
              <div
                key={room.id}
                className="relative grid border-b border-black/[0.04]"
                style={{ gridTemplateColumns: cols, gridTemplateRows: "2.25rem" }}
              >
                <Link
                  href={`/admin/hotel/${hotel.id}?tab=calendar`}
                  className="sticky left-0 z-10 flex items-center truncate bg-white pr-2 text-xs font-medium text-ink hover:text-aldeitas"
                  title={room.title}
                  style={{ gridColumn: 1, gridRow: 1 }}
                >
                  <span className="truncate">{room.title}</span>
                </Link>
                {days.map((key, i) => {
                  const weekend = dayParts(key, locale).weekend;
                  const price = room.prices[i];
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-center border-l border-black/[0.03] text-[9px] tabular-nums text-muted/80 ${
                        i === todayIndex ? "bg-aldeitas/[0.07]" : weekend ? "bg-surface/50" : ""
                      }`}
                      style={{ gridColumn: i + 2, gridRow: 1 }}
                    >
                      {price ? compact(price) : ""}
                    </div>
                  );
                })}
                {room.spans.map((span) => {
                  const body = (
                    <>
                      <span className="truncate">{span.label}</span>
                      {span.guestCount ? <span className="ml-1 shrink-0 opacity-75">· {t.guests(span.guestCount)}</span> : null}
                    </>
                  );
                  const cls = `z-[5] my-1 flex items-center overflow-hidden px-1.5 text-[11px] font-medium shadow-sm ${SOURCE_BAR[span.source]} ${
                    span.startsBefore ? "rounded-l-none" : "ml-1 rounded-l-md"
                  } ${span.endsAfter ? "rounded-r-none" : "mr-1 rounded-r-md"}`;
                  const style = { gridColumn: `${span.start + 2} / ${span.end + 3}`, gridRow: 1 };
                  return span.bookingId ? (
                    <Link key={span.id} href={`/admin/bookings/${span.bookingId}`} className={`${cls} hover:brightness-110`} style={style} title={span.label}>
                      {body}
                    </Link>
                  ) : (
                    <div key={span.id} className={cls} style={style} title={span.label}>
                      {body}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HostPanel({
  hotels,
  days,
  stats,
  insights,
}: {
  hotels: PanelHotel[];
  days: string[];
  stats: HotelStats | null;
  insights: HostInsight[];
}) {
  const { locale: userLocale } = useLocale();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const locale = hydrated ? userLocale : "es";
  const lang = locale === "en" ? "en" : "es";
  const t = COPY[lang];

  if (!stats || hotels.every((h) => h.rooms.length === 0)) {
    return <Card className="text-sm text-muted">{t.noRooms}</Card>;
  }
  const k = stats.kpis;
  const trend = k.occupancyNext30 - k.occupancyPast30;
  const firstHotel = hotels.find((h) => h.rooms.length > 0);
  const stays = (rows: HotelStats["arrivals"], checkout: boolean) =>
    rows.length ? (
      <ul className="space-y-1.5">
        {rows.slice(0, 5).map((r) => (
          <li key={`${r.roomTitle}-${r.checkIn}-${r.guestName}`} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_DOT[r.source]}`} />
            <span className="w-12 shrink-0 tabular-nums text-muted">
              {new Date(`${checkout ? r.checkOut : r.checkIn}T00:00:00`).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
                weekday: "short",
                day: "numeric",
              })}
            </span>
            <span className="truncate font-medium text-ink">{r.guestName}</span>
            <span className="ml-auto truncate text-muted">{r.roomTitle}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-muted">{t.none}</p>
    );

  const kpis = (
    <div className="grid grid-cols-2 gap-2">
      <Kpi label={t.occupancy30} value={percent(k.occupancyNext30)} sub={t.vsPast(percent(k.occupancyPast30))} trend={trend} />
      <Kpi label={t.revenuePast30} value={money(k.revenuePast30Cents)} />
      <Kpi label={t.onBooks90} value={money(k.revenueNext90Cents)} />
      <Kpi label={t.adr} value={k.adrCents ? money(k.adrCents) : "—"} />
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="lg:hidden">{kpis}</div>
        <Card>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-heading">{t.calendar}</h2>
              <p className="text-xs text-muted">{t.calendarNote}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
              {(["aldeitas", "airbnb", "vrbo", "blocked"] as StaySource[]).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-sm ${SOURCE_DOT[s]}`} />
                  {t.legend[s]}
                </span>
              ))}
              {firstHotel ? (
                <Link href={`/admin/hotel/${firstHotel.id}?tab=calendar`} className="font-semibold text-aldeitas hover:underline">
                  {t.openFull} →
                </Link>
              ) : null}
            </div>
          </div>
          <PortfolioCalendar hotels={hotels} days={days} todayKey={stats.todayKey} locale={lang} t={t} />
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-heading">{t.whatsUp}</h3>
            <ul className="space-y-2">
              {insights.map((ins) => (
                <li key={ins.id} className={`rounded-lg border p-2.5 ${TONE[ins.tone].ring}`}>
                  <p className="flex items-center gap-2 text-xs font-semibold text-heading">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[ins.tone].dot}`} />
                    {ins.title[lang]}
                  </p>
                  <p className="mt-1 pl-4 text-xs leading-snug text-ink/80">{ins.body[lang]}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-heading">{t.next7}</h3>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.arrivals}</p>
            {stays(stats.arrivals, false)}
            <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.departures}</p>
            {stays(stats.departures, true)}
          </Card>
        </div>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-heading">{t.rooms}</h3>
          <ul className="space-y-2">
            {stats.rooms.map((room) => (
              <li key={room.id} className="grid grid-cols-[minmax(6rem,12rem)_1fr_3rem] items-center gap-3 text-xs">
                <span className="truncate font-medium text-ink" title={room.title}>
                  {room.title}
                </span>
                <span className="flex h-3 gap-px overflow-hidden rounded">
                  {room.next30Strip.split("").map((c, i) => (
                    <span key={i} className={`flex-1 ${STRIP_CLASS[c] ?? STRIP_CLASS.f}`} />
                  ))}
                </span>
                <span className="text-right font-semibold tabular-nums text-heading">{percent(room.occupancyNext30)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <aside className="space-y-4">
        <div className="hidden lg:block">{kpis}</div>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-heading">{t.pace}</h3>
          <PaceChart stats={stats} todayLabel={t.today} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-heading">{t.channels}</h3>
          <ChannelBar stats={stats} labels={t.legend} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-heading">{t.months}</h3>
          <MonthBars stats={stats} locale={lang} />
        </Card>
      </aside>
    </div>
  );
}
