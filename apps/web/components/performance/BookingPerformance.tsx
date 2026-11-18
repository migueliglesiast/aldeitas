"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import { formatMoney } from "@/lib/currency";
import type { Bucket, PerfChannel, PerformanceReport, Rec, StayRow } from "@/lib/booking-performance";
import type { MarketData } from "@/lib/booking-performance-data";
import BookingPace from "./BookingPace";

type Lang = "es" | "en";
const L = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const money = (c: number | null | undefined) => (c == null ? "—" : formatMoney(c, undefined, { maximumFractionDigits: 0 }));

const CHANNEL: Record<PerfChannel, { es: string; en: string; cls: string }> = {
  aldeitas: { es: "Aldeitas", en: "Aldeitas", cls: "bg-aldeitas text-white" },
  airbnb: { es: "Airbnb", en: "Airbnb", cls: "bg-[#FF5A5F] text-white" },
  direct: { es: "Directa", en: "Direct", cls: "bg-slate-600 text-white" },
};
const TONE: Record<Rec["tone"], string> = {
  alert: "border-red-200 bg-red-50",
  warn: "border-amber-200 bg-amber-50",
  info: "border-sky-200 bg-sky-50",
  good: "border-emerald-200 bg-emerald-50",
};

function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      {title ? <h2 className="mb-3 text-sm font-semibold text-heading">{title}</h2> : null}
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-heading">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Bars({ data, format = (v: number) => String(v), color = "bg-aldeitas" }: { data: Bucket[]; format?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-36 items-end gap-1">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-slate-500">{d.value ? format(d.value) : ""}</span>
          <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(2, (d.value / max) * 100)}px` }} />
          <span className="truncate text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Recs({ recs, lang }: { recs: Rec[]; lang: Lang }) {
  if (!recs.length) return null;
  return (
    <ul className="space-y-2">
      {recs.map((r) => {
        const [title, body] = lang === "es" ? r.es : r.en;
        return (
          <li key={r.id} className={`rounded-lg border p-3 ${TONE[r.tone]}`}>
            <div className="text-sm font-semibold text-heading">{title}</div>
            <div className="mt-0.5 text-sm text-slate-700">{body}</div>
          </li>
        );
      })}
    </ul>
  );
}

function monthLabel(key: string, dateLocale: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale, { month: "short" });
}

function shortDate(k: string | null, dateLocale: string) {
  if (!k) return "—";
  return new Date(`${k}T00:00:00`).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "2-digit" });
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-slate-400">—</span>;
  const cls = delta >= 5 ? "bg-emerald-100 text-emerald-800" : delta <= -5 ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{delta > 0 ? "+" : ""}{delta}%</span>;
}

function StayTable({ rows, lang, dateLocale }: { rows: StayRow[]; lang: Lang; dateLocale: string }) {
  const [room, setRoom] = useState("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const roomTitles = [...new Set(rows.map((r) => r.roomTitle))].sort();
  const visible = rows.filter((r) => (room === "all" || r.roomTitle === room) && (showCancelled || r.status !== "cancelled"));
  return (
    <Card title={L(lang, "Reservas", "Bookings")}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={room} onChange={(e) => setRoom(e.target.value)} className="rounded border border-slate-300 px-2 py-1" aria-label={L(lang, "Habitación", "Room")}>
          <option value="all">{L(lang, "Todas las habitaciones", "All rooms")}</option>
          {roomTitles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          {L(lang, "Mostrar canceladas / sin pagar", "Show cancelled / unpaid")}
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{L(lang, "Aún no hay reservas registradas.", "No bookings recorded yet.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">{L(lang, "Reservada", "Booked")}</th>
                <th className="pr-3">{L(lang, "Habitación", "Room")}</th>
                <th className="pr-3">{L(lang, "Estancia", "Stay")}</th>
                <th className="pr-3">{L(lang, "Canal", "Channel")}</th>
                <th className="pr-3 text-right">{L(lang, "Anticipación", "Lead")}</th>
                <th className="pr-3 text-right">{L(lang, "Total", "Total")}</th>
                <th className="pr-3 text-right">{L(lang, "Por noche", "Per night")}</th>
                <th className="pr-3 text-right">{L(lang, "Habitual", "Usual")}</th>
                <th className="text-right">{L(lang, "Dif.", "Diff.")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={`border-b last:border-0 ${r.status === "cancelled" ? "text-slate-400 line-through" : ""}`}>
                  <td className="py-2 pr-3 whitespace-nowrap">{shortDate(r.bookedAt, dateLocale)}</td>
                  <td className="pr-3">{r.roomTitle}</td>
                  <td className="pr-3 whitespace-nowrap">
                    {shortDate(r.start, dateLocale)} → {shortDate(r.end, dateLocale)}
                    <span className="ml-1 text-xs text-slate-500">· {r.nights} {L(lang, "n", "n")}</span>
                  </td>
                  <td className="pr-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${CHANNEL[r.channel].cls}`}>{CHANNEL[r.channel][lang]}</span>
                    {r.estimated ? <span className="ml-1 text-xs text-slate-500">{L(lang, "estimada", "estimated")}</span> : null}
                    {r.status === "pending" ? <span className="ml-1 text-xs text-amber-700">{L(lang, "por cobrar", "authorized")}</span> : null}
                  </td>
                  <td className="pr-3 text-right">{r.leadDays == null ? "—" : `${r.leadDays} d`}</td>
                  <td className="pr-3 text-right">{money(r.totalCents)}</td>
                  <td className="pr-3 text-right">{money(r.paidNightlyCents)}</td>
                  <td className="pr-3 text-right text-slate-500">{money(r.usualNightlyCents)}</td>
                  <td className="text-right"><DeltaBadge delta={r.deltaPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            {L(lang,
              "Aldeitas: lo que pagó el huésped vs la tarifa del hotel + 5% esas noches. Airbnb/Directa: pago al anfitrión vs la tarifa del hotel. El total puede incluir limpieza y extras. \"Estimada\": noches no disponibles en el calendario público de Airbnb (puede ser reserva o bloqueo); sin fecha de reserva ni precio hasta conectar el Gmail del hotel.",
              "Aldeitas: what the guest paid vs the hotel rate + 5% for those nights. Airbnb/Direct: host payout vs the hotel rate. Totals may include cleaning and extras. \"Estimated\": nights unavailable on Airbnb's public calendar (a booking or a block); no booking date or price until the hotel's Gmail is connected.")}
          </p>
        </div>
      )}
    </Card>
  );
}

export default function BookingPerformance({
  hotel,
  report,
  recs,
  children,
}: {
  hotel: { id: string; name: string; location: string };
  report: PerformanceReport;
  recs: Rec[];
  children?: ReactNode;
}) {
  const { locale, dateLocale } = useLocale();
  const lang: Lang = locale === "en" ? "en" : "es";
  const k = report.kpis;
  const trend = k.bookingsLast30 - k.bookingsPrev30;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/admin/hotel/${hotel.id}`} className="text-sm text-aldeitas hover:underline">← {hotel.name}</Link>
          <h1 className="text-2xl font-semibold text-heading">{L(lang, "Rendimiento de reservas", "Booking performance")}</h1>
          <p className="text-sm text-slate-500">{hotel.name} · {hotel.location}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label={L(lang, "Reservas (30 días)", "Bookings (30 days)")} value={String(k.bookingsLast30)}
          hint={`${trend >= 0 ? "+" : ""}${trend} ${L(lang, "vs 30 días previos", "vs prior 30 days")}`} />
        <Kpi label={L(lang, "Ocupación próx. 30 días", "Occupancy next 30 days")} value={pct(k.occupancyNext30)} hint={`${k.nightsNext30} ${L(lang, "noches", "nights")}`} />
        <Kpi label={L(lang, "Ocupación próx. 90 días", "Occupancy next 90 days")} value={pct(k.occupancyNext90)} />
        <Kpi label={L(lang, "Ingresos próx. 90 días", "Revenue next 90 days")} value={money(k.revenueNext90Cents)} />
        <Kpi label={L(lang, "Anticipación media", "Avg lead time")} value={k.avgLeadDays == null ? "—" : `${k.avgLeadDays} d`}
          hint={k.avgNights == null ? undefined : `${k.avgNights} ${L(lang, "noches por estancia", "nights per stay")}`} />
        <Kpi label={L(lang, "Precio vs habitual", "Price vs usual")} value={k.avgDeltaPct == null ? "—" : `${k.avgDeltaPct > 0 ? "+" : ""}${k.avgDeltaPct}%`} />
      </div>

      <BookingPace rows={report.rows} today={report.today} lang={lang} dateLocale={dateLocale} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={L(lang, "Cuándo se reserva (por semana)", "When bookings happen (per week)")} className="lg:col-span-2">
          <Bars data={report.weekly} />
        </Card>
        <Card title={L(lang, "Recomendaciones", "Recommendations")}>
          {recs.length ? <Recs recs={recs} lang={lang} /> : <p className="text-sm text-slate-500">{L(lang, "Todo en orden.", "All good.")}</p>}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title={L(lang, "Ocupación y tarifa por mes", "Occupancy and rate by month")}>
          <div className="space-y-2">
            {report.months.map((m) => (
              <div key={m.key} className="text-sm">
                <div className="flex justify-between text-xs text-slate-600">
                  <span className="capitalize">{monthLabel(m.key, dateLocale)}</span>
                  <span>{pct(m.occupancy)} · {money(m.avgRateCents)}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-aldeitas" style={{ width: `${Math.min(100, m.occupancy * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title={L(lang, "Anticipación (días antes de llegar)", "Lead time (days before arrival)")}>
          <Bars data={report.leadTime} color="bg-sky-500" />
        </Card>
        <Card title={L(lang, "Duración de estancia (noches)", "Length of stay (nights)")}>
          <Bars data={report.lengthOfStay} color="bg-amber-500" />
        </Card>
      </div>

      {report.channels.length ? (
        <Card title={L(lang, "Noches por canal", "Nights by channel")}>
          <div className="flex h-4 overflow-hidden rounded">
            {report.channels.map((c) => (
              <div key={c.channel} className={CHANNEL[c.channel].cls} style={{ flex: c.nights }} title={`${CHANNEL[c.channel][lang]}: ${c.nights}`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
            {report.channels.map((c) => <span key={c.channel}>{CHANNEL[c.channel][lang]}: {c.nights}</span>)}
          </div>
        </Card>
      ) : null}

      {children}

      <StayTable rows={report.rows} lang={lang} dateLocale={dateLocale} />
    </div>
  );
}

export function MarketSkeleton() {
  return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />;
}

function Compare({ label, own, area }: { label: string; own: string; area: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-xl font-semibold text-heading">{own}</span><span className="text-sm text-slate-500">/ {area}</span></div>
    </div>
  );
}

function cellTitle(t0: Date, i: number, v: boolean | null, rate: number | null | undefined, lang: Lang, dateLocale: string) {
  const date = new Date(t0.getTime() + i * 86400000).toLocaleDateString(dateLocale);
  let state = L(lang, "cerrado", "closed");
  if (v === true) state = L(lang, "ocupado", "booked");
  else if (v === false) state = L(lang, "libre", "free");
  return rate ? date + ": " + state + " · " + money(rate) : date + ": " + state;
}

export function MarketPanel({ data }: { data: MarketData }) {
  const { locale, dateLocale } = useLocale();
  const lang: Lang = locale === "en" ? "en" : "es";
  const { own, area } = data;
  const t0 = new Date(`${data.today}T00:00:00`);
  return (
    <Card title={L(lang, "Tú vs la zona (calendarios públicos de Airbnb)", "You vs the area (Airbnb public calendars)")}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Compare label={L(lang, "Ocupado 30 días · tú / zona", "Booked 30 days · you / area")} own={pct(own.occ30)} area={pct(area.occ30)} />
            <Compare label={L(lang, "Ocupado 60 días", "Booked 60 days")} own={pct(own.occ60)} area={pct(area.occ60)} />
            <Compare label={L(lang, "Ocupado 90 días", "Booked 90 days")} own={pct(own.occ90)} area={pct(area.occ90)} />
            <Compare label={L(lang, "Tarifa mediana/noche", "Median nightly rate")} own={money(own.medianRate)} area={money(area.medianRate)} />
          </div>
          <p className="text-xs text-slate-500">
            {L(lang,
              `Zona: ${area.listings} habitaciones de ${area.hotels} hoteles cercanos en Aldeitas; tarifas de ${area.priced} (rango típico ${money(area.p25)}–${money(area.p75)}). Tarifas = precio de Airbnb −16%, como la tarifa del hotel. Ocupado = reservado o bloqueado en Airbnb; se excluyen cierres largos.`,
              `Area: ${area.listings} rooms from ${area.hotels} nearby Aldeitas hotels; rates from ${area.priced} (typical range ${money(area.p25)}–${money(area.p75)}). Rates = Airbnb price −16%, like the hotel rate. Booked = booked or blocked on Airbnb; long closures excluded.`)}
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-0.5 pl-28 text-[10px] text-slate-400">
              {[0, 30, 60].map((i) => (
                <span key={i} style={{ flex: 30 }}>{new Date(t0.getTime() + i * 86400000).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}</span>
              ))}
            </div>
            {data.rooms.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="shrink-0 truncate text-xs text-slate-700" style={{ width: "6.5rem" }} title={r.title}>{r.title}</span>
                <div className="flex h-4 flex-1 gap-px">
                  {r.strip.length === 0 ? (
                    <span className="text-[10px] text-slate-400">{L(lang, "sin calendario de Airbnb", "no Airbnb calendar")}</span>
                  ) : (
                    r.strip.map((v, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-[1px] ${v === true ? "bg-[#FF5A5F]" : v === false ? "bg-emerald-200" : "bg-slate-200"}`}
                        title={cellTitle(t0, i, v, r.rates[i], lang, dateLocale)}
                      />
                    ))
                  )}
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-slate-500">{pct(r.occ30)}</span>
              </div>
            ))}
            <div className="flex gap-3 pl-28 text-[10px] text-slate-500">
              <span><i className="mr-1 inline-block h-2 w-2 bg-[#FF5A5F]" />{L(lang, "ocupado", "booked")}</span>
              <span><i className="mr-1 inline-block h-2 w-2 bg-emerald-200" />{L(lang, "libre", "free")}</span>
              <span><i className="mr-1 inline-block h-2 w-2 bg-slate-200" />{L(lang, "cerrado", "closed")}</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            {data.months.map((m) => (
              <div key={m.key} className="text-xs">
                <div className="capitalize text-slate-600">{monthLabel(m.key, dateLocale)}</div>
                <div className="mt-1 flex items-center gap-2"><span className="w-10 text-slate-500">{L(lang, "Tú", "You")}</span><div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded bg-aldeitas" style={{ width: `${(m.own ?? 0) * 100}%` }} /></div><span className="w-8 text-right">{pct(m.own)}</span></div>
                <div className="mt-0.5 flex items-center gap-2"><span className="w-10 text-slate-500">{L(lang, "Zona", "Area")}</span><div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded bg-slate-500" style={{ width: `${(m.area ?? 0) * 100}%` }} /></div><span className="w-8 text-right">{pct(m.area)}</span></div>
              </div>
            ))}
          </div>
          <Recs recs={data.recs} lang={lang} />
        </div>
      </div>
    </Card>
  );
}
