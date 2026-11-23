"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { bookingPace, dayMonth, PACE_BUCKETS, type StayRow } from "@/lib/booking-performance";

type Lang = "es" | "en";
const L = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);
const FILL = ["#f43f5e", "#f59e0b", "#0ea5e9", "#0f766e"];
const RANGES = [30, 90, 180, 365];
const HISTORY_DAYS = 400;
const day = (k: string) => parseISO(`${k}T00:00:00`);
const ARRIVES: Array<[string, string]> = [
  ["Llegan en 7 días o menos", "Arrive within 7 days"],
  ["Llegan en 8 a 30 días", "Arrive in 8–30 days"],
  ["Llegan en 31 a 90 días", "Arrive in 31–90 days"],
  ["Llegan en más de 90 días", "Arrive in more than 90 days"],
];

function monthName(key: string, dateLocale: string) {
  const s = day(`${key}-01`).toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function HBar({ label, value, max, total, color }: { label: string; value: number; max: number; total: number; color: string }) {
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-slate-700">{label}</span>
        <span className="shrink-0 font-semibold text-heading">
          {value} <span className="font-normal text-slate-500">({total ? Math.round((value / total) * 100) : 0}%)</span>
        </span>
      </div>
      <div className="mt-1 h-3 rounded bg-slate-100">
        <div className="h-3 rounded" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </li>
  );
}

export default function BookingPace({ rows, today, lang, dateLocale }: { rows: StayRow[]; today: string; lang: Lang; dateLocale: string }) {
  const [range, setRange] = useState(90);
  const { days, points } = useMemo(() => bookingPace(rows, today, range), [rows, today, range]);
  const prev = useMemo(() => bookingPace(rows, format(addDays(day(today), -range), "yyyy-MM-dd"), range).points.length, [rows, today, range]);

  // Few, wide bars so every one can carry its number and date.
  const step = range <= 30 ? 3 : range <= 90 ? 7 : range <= 180 ? 14 : 30;
  const cols = useMemo(() => {
    const out: Array<{ date: string; end: string; total: number }> = [];
    // Only whole periods, so a short leftover at the start doesn't look like a slow week.
    for (let i = days.length; i >= step; i -= step) {
      const chunk = days.slice(i - step, i);
      out.unshift({ date: chunk[0].date, end: chunk[chunk.length - 1].date, total: chunk.reduce((a, d) => a + d.total, 0) });
    }
    return out;
  }, [days, step]);
  const maxCol = Math.max(1, ...cols.map((c) => c.total));
  // Label every bar when few, otherwise every few counting back from the latest, so phone labels don't collide.
  const labelEvery = cols.length <= 6 ? 1 : Math.ceil(cols.length / 5);
  const total = points.length;
  // The report loads ~400 days of stays, so only compare when the prior window fits.
  const change = prev && range * 2 <= HISTORY_DAYS ? Math.round(((total - prev) / prev) * 100) : null;
  const leads = points.map((p) => p.lead).sort((a, b) => a - b);
  const mid = Math.floor(leads.length / 2);
  const medianLead = leads.length ? (leads.length % 2 ? leads[mid] : Math.round((leads[mid - 1] + leads[mid]) / 2)) : null;

  const byBucket = PACE_BUCKETS.map((_, b) => points.filter((p) => p.bucket === b).length);
  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) m.set(p.checkIn.slice(0, 7), (m.get(p.checkIn.slice(0, 7)) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [points]);
  const topMonth = byMonth.reduce<[string, number] | null>((best, e) => (!best || e[1] > best[1] ? e : best), null);
  const unit = step === 3 ? L(lang, "cada 3 días", "every 3 days") : step === 7 ? L(lang, "por semana", "per week") : step === 14 ? L(lang, "cada 2 semanas", "every 2 weeks") : L(lang, "cada 30 días", "every 30 days");
  const rangeLabel = (r: number) => (r === 365 ? L(lang, "1 año", "1 year") : `${r} ${L(lang, "días", "days")}`);

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-heading">{L(lang, "Reservas recibidas", "Bookings received")}</h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label={L(lang, "Periodo", "Period")}>
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={r === range}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${r === range ? "bg-heading text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {rangeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-base leading-relaxed text-slate-700">
        <p>
          {L(lang, "En los últimos", "In the last")} <strong>{rangeLabel(range)}</strong> {L(lang, "recibiste", "you received")}{" "}
          <strong className="text-heading">{total} {L(lang, total === 1 ? "reserva" : "reservas", total === 1 ? "booking" : "bookings")}</strong>.
          {change === 0 ? <> {L(lang, `Igual que los ${range} días anteriores (${prev}).`, `Same as the previous ${range} days (${prev}).`)}</> : null}
          {change ? (
            <> <span className={change > 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
              {change > 0 ? "▲" : "▼"} {Math.abs(change)}% {change > 0 ? L(lang, "más", "more") : L(lang, "menos", "fewer")}
            </span> {L(lang, `que los ${range} días anteriores (${prev}).`, `than the previous ${range} days (${prev}).`)}</>
          ) : null}
        </p>
        {medianLead != null ? (
          <p>{L(lang, "La mitad de los huéspedes reserva", "Half of guests book")} <strong>{medianLead} {L(lang, medianLead === 1 ? "día" : "días", medianLead === 1 ? "day" : "days")}</strong> {L(lang, "o menos antes de llegar.", "or less before arriving.")}</p>
        ) : null}
        {topMonth ? (
          <p>{L(lang, "El mes con más llegadas reservadas es", "The month with the most arrivals booked is")} <strong>{monthName(topMonth[0], dateLocale)}</strong> ({topMonth[1]}).</p>
        ) : null}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-slate-700">{L(lang, "Reservas recibidas", "Bookings received")} {unit}</h3>
      <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={cols.map((c) => `${dayMonth(c.date, dateLocale)}: ${c.total}`).join(", ")}>
        {cols.map((c, i) => (
          <div key={c.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${dayMonth(c.date, dateLocale)} – ${dayMonth(c.end, dateLocale)}: ${c.total}`}>
            <span className="text-xs font-semibold text-slate-700">{c.total || ""}</span>
            <div className={`w-full rounded-t ${i === cols.length - 1 ? "bg-heading" : "bg-aldeitas"}`} style={{ height: `${Math.max(2, (c.total / maxCol) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-slate-200 pt-1 sm:gap-2">
        {cols.map((c, i) => (
          <span key={c.date} className="min-w-0 flex-1 whitespace-nowrap text-center text-xs text-slate-600">
            {(cols.length - 1 - i) % labelEvery === 0 ? dayMonth(c.date, dateLocale) : ""}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{L(lang, "¿Con cuánta anticipación reservan?", "How far ahead do they book?")}</h3>
          <ul className="space-y-3">
            {ARRIVES.map(([es, en], b) => (
              <HBar key={en} label={L(lang, es, en)} value={byBucket[b]} max={Math.max(1, ...byBucket)} total={total} color={FILL[b]} />
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{L(lang, "¿Para qué mes son esas reservas?", "Which month are those stays for?")}</h3>
          {byMonth.length ? (
            <ul className="space-y-3">
              {byMonth.map(([k, n]) => (
                <HBar key={k} label={monthName(k, dateLocale)} value={n} max={Math.max(1, ...byMonth.map((e) => e[1]))} total={total} color="#0f766e" />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{L(lang, "Sin reservas en este periodo.", "No bookings in this period.")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
