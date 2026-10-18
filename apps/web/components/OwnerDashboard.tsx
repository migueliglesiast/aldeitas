"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import type { HotelStats, StaySource } from "@/lib/hotel-stats";

const COPY = {
  es: {
    overview: "Resumen",
    occupancyNext30: "Ocupación · próximos 30 días",
    vsPast30: "últimos 30 días",
    revenuePast30: "Ingresos · últimos 30 días",
    onTheBooks: "Reservado · próximos 90 días",
    adr: "Tarifa media por noche",
    revpar: "Ingreso por cuarto disponible",
    avgStay: "Estancia media",
    nights: "noches",
    night: "noche",
    blocked: "Noches bloqueadas (30 días)",
    ghosts: "Noches fantasma (90 días)",
    timeline: "Ocupación diaria",
    timelineNote: "30 días atrás y 60 hacia adelante · % de cuartos ocupados",
    today: "Hoy",
    next7: "Próximos 7 días",
    arrivals: "Llegadas",
    departures: "Salidas",
    none: "Sin movimientos",
    more: "más",
    guests: "huéspedes",
    channels: "Por canal · próximos 90 días",
    months: "Por mes",
    rooms: "Por cuarto",
    room: "Cuarto",
    occPast: "Últimos 30",
    occNext: "Próximos 30",
    booked90: "Noches (90 d)",
    revenue90: "Ingresos (90 d)",
    listed: "Tarifa publicada",
    footnote: (rate: number) =>
      `Ingresos = pagos al anfitrión de Airbnb y Vrbo cuando se conocen, y total cobrado en Aldeitas; repartidos por noche. USD convertidos a ${rate} MXN. Las estancias sin pago registrado cuentan para la ocupación pero no para los ingresos.`,
    source: { airbnb: "Airbnb", aldeitas: "Aldeitas", vrbo: "Vrbo", blocked: "Bloqueado", ghost: "Fantasma" },
  },
  en: {
    overview: "Overview",
    occupancyNext30: "Occupancy · next 30 days",
    vsPast30: "last 30 days",
    revenuePast30: "Revenue · last 30 days",
    onTheBooks: "On the books · next 90 days",
    adr: "Average nightly rate",
    revpar: "Revenue per available room",
    avgStay: "Average stay",
    nights: "nights",
    night: "night",
    blocked: "Blocked nights (30 days)",
    ghosts: "Ghost nights (90 days)",
    timeline: "Daily occupancy",
    timelineNote: "30 days back and 60 ahead · % of rooms occupied",
    today: "Today",
    next7: "Next 7 days",
    arrivals: "Arrivals",
    departures: "Departures",
    none: "Nothing scheduled",
    more: "more",
    guests: "guests",
    channels: "By channel · next 90 days",
    months: "By month",
    rooms: "By room",
    room: "Room",
    occPast: "Last 30",
    occNext: "Next 30",
    booked90: "Nights (90 d)",
    revenue90: "Revenue (90 d)",
    listed: "Listed rate",
    footnote: (rate: number) =>
      `Revenue = Airbnb and Vrbo host payouts where known, and the Aldeitas total charged; spread per night. USD converted at ${rate} MXN. Stays without a recorded payout count toward occupancy but not revenue.`,
    source: { airbnb: "Airbnb", aldeitas: "Aldeitas", vrbo: "Vrbo", blocked: "Blocked", ghost: "Ghost" },
  },
} as const;

const SOURCE_COLOR: Record<StaySource, string> = {
  airbnb: "bg-[#0f766e]",
  aldeitas: "bg-aldeitas",
  vrbo: "bg-heading",
  blocked: "bg-slate-300",
  ghost: "bg-slate-200",
};

function money(cents: number, locale: string) {
  return (cents / 100).toLocaleString(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
}

const MAX_STAYS = 5;

const percent = (value: number) => `${Math.round(value * 100)}%`;

function shortDate(key: string, locale: string) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function monthLabel(key: string, locale: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
  });
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3 sm:mb-4">
      <h3 className="text-sm font-semibold text-heading">{children}</h3>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-3 sm:p-5">
      <p className="text-[11px] leading-tight text-muted sm:text-xs">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-heading sm:text-3xl">
        {value}
      </p>
      {sub ? <p className="mt-1 text-[11px] text-muted sm:text-xs">{sub}</p> : null}
    </div>
  );
}

function Timeline({ stats, todayLabel }: { stats: HotelStats; todayLabel: string }) {
  const points = stats.timeline;
  const width = 900;
  const height = 160;
  const pad = { top: 12, bottom: 22, left: 30 };
  const barW = (width - pad.left) / Math.max(points.length, 1);
  const todayIndex = points.findIndex((p) => p.day === stats.todayKey);
  const y = (v: number) => pad.top + (1 - v) * (height - pad.top - pad.bottom);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Daily occupancy, last 30 days and next 60 days"
    >
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width} y1={y(v)} y2={y(v)} stroke="#000" strokeOpacity={0.06} />
          <text x={0} y={y(v) + 4} fontSize={11} fill="#78736B">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const h = Math.max(p.pct > 0 ? 2 : 0, (height - pad.top - pad.bottom) * p.pct);
        const past = todayIndex >= 0 && i < todayIndex;
        return (
          <rect
            key={p.day}
            x={pad.left + i * barW + 1}
            y={y(p.pct)}
            width={Math.max(barW - 2, 1)}
            height={h}
            rx={1.5}
            fill={past ? "#C9C4BB" : "#0092A1"}
          >
            <title>{`${p.day}: ${percent(p.pct)} (${p.occupied}/${stats.roomCount})`}</title>
          </rect>
        );
      })}
      {todayIndex >= 0 ? (
        <g>
          <line
            x1={pad.left + todayIndex * barW}
            x2={pad.left + todayIndex * barW}
            y1={pad.top - 6}
            y2={height - pad.bottom}
            stroke="#4F4C48"
            strokeDasharray="3 3"
          />
          <text
            x={pad.left + todayIndex * barW + 4}
            y={height - 6}
            fontSize={11}
            fill="#4F4C48"
            fontWeight={600}
          >
            {todayLabel}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export default function OwnerDashboard({ stats }: { stats: HotelStats }) {
  const { locale } = useLocale();
  const t = COPY[locale === "en" ? "en" : "es"];
  const k = stats.kpis;
  const totalSourceNights = stats.sources.reduce((s, r) => s + r.nights, 0);

  const stayList = (rows: HotelStats["arrivals"], useCheckout: boolean) =>
    rows.length ? (
      <ul className="divide-y divide-black/[0.06]">
        {rows.slice(0, MAX_STAYS).map((row) => (
          <li
            key={`${row.roomTitle}-${row.checkIn}`}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {row.guestName || t.source[row.source]}
              </p>
              <p className="truncate text-xs text-muted">
                {row.roomTitle} · {row.nights} {row.nights === 1 ? t.night : t.nights}
                {row.guestCount ? ` · ${row.guestCount} ${t.guests}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-heading">
                {shortDate(useCheckout ? row.checkOut : row.checkIn, locale)}
              </p>
              <p className="text-[11px] text-muted">{t.source[row.source]}</p>
            </div>
          </li>
        ))}
        {rows.length > MAX_STAYS ? (
          <li className="pt-2 text-xs text-muted">
            +{rows.length - MAX_STAYS} {t.more}
          </li>
        ) : null}
      </ul>
    ) : (
      <p className="py-2 text-sm text-muted">{t.none}</p>
    );

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="pt-2 text-base font-semibold text-heading sm:pt-4 sm:text-xl">{t.overview}</h2>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Kpi
          label={t.occupancyNext30}
          value={percent(k.occupancyNext30)}
          sub={`${percent(k.occupancyPast30)} ${t.vsPast30}`}
        />
        <Kpi label={t.revenuePast30} value={money(k.revenuePast30Cents, locale)} />
        <Kpi label={t.onTheBooks} value={money(k.revenueNext90Cents, locale)} />
        <Kpi
          label={t.adr}
          value={k.adrCents != null ? money(k.adrCents, locale) : "—"}
          sub={`${t.revpar}: ${money(k.revparNext30Cents, locale)}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Kpi
          label={t.avgStay}
          value={k.avgStayNights != null ? `${k.avgStayNights}` : "—"}
          sub={t.nights}
        />
        <Kpi label={t.blocked} value={`${k.blockedNightsNext30}`} />
        <Kpi label={t.ghosts} value={`${k.ghostNights}`} />
      </div>

      <Card>
        <CardTitle note={t.timelineNote}>{t.timeline}</CardTitle>
        <Timeline stats={stats} todayLabel={t.today} />
      </Card>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>{t.next7}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {t.arrivals} · {stats.arrivals.length}
              </p>
              {stayList(stats.arrivals, false)}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {t.departures} · {stats.departures.length}
              </p>
              {stayList(stats.departures, true)}
            </div>
          </div>
        </Card>

        <div className="space-y-3 sm:space-y-4">
          <Card>
            <CardTitle>{t.channels}</CardTitle>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {stats.sources.map((row) => (
                <div
                  key={row.source}
                  className={SOURCE_COLOR[row.source]}
                  style={{ width: `${(row.nights / Math.max(totalSourceNights, 1)) * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {stats.sources.map((row) => (
                <li key={row.source} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <span className={`h-2.5 w-2.5 rounded-sm ${SOURCE_COLOR[row.source]}`} />
                    {t.source[row.source]}
                  </span>
                  <span className="tabular-nums text-muted">
                    {row.nights} {t.nights} ·{" "}
                    {percent(row.nights / Math.max(totalSourceNights, 1))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>{t.months}</CardTitle>
            <ul className="space-y-3">
              {stats.months.map((m) => (
                <li key={m.month}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="capitalize text-ink">{monthLabel(m.month, locale)}</span>
                    <span className="tabular-nums text-muted">
                      {percent(m.occupancy)} · {money(m.revenueCents, locale)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-aldeitas"
                      style={{ width: percent(m.occupancy) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <CardTitle>{t.rooms}</CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.07] text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2 font-medium sm:px-5">{t.room}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t.occPast}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t.occNext}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t.booked90}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t.revenue90}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">{t.listed}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] tabular-nums">
              {stats.rooms.map((room) => (
                <tr key={room.id}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink sm:px-5">
                    {room.title}
                  </th>
                  <td className="px-3 py-2.5 text-right text-muted">{percent(room.occupancyPast30)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 sm:inline-block">
                        <span
                          className="block h-full rounded-full bg-aldeitas"
                          style={{ width: percent(room.occupancyNext30) }}
                        />
                      </span>
                      <span className="text-ink">{percent(room.occupancyNext30)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink">{room.nightsNext90}</td>
                  <td className="px-3 py-2.5 text-right text-ink">
                    {money(room.revenueNext90Cents, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted sm:px-5">
                    {room.listedRateCents != null ? money(room.listedRateCents, locale) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] leading-relaxed text-muted sm:text-xs">{t.footnote(stats.usdToMxn)}</p>
    </div>
  );
}
