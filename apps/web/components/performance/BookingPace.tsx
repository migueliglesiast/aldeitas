"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { bookingPace, dayMonth, PACE_BUCKETS, type StayRow } from "@/lib/booking-performance";

type Lang = "es" | "en";
const L = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);
const FILL = ["#f43f5e", "#f59e0b", "#0ea5e9", "#0f766e"];
const RANGES = [30, 90, 180, 365];
const HISTORY_DAYS = 400;
const day = (k: string) => parseISO(`${k}T00:00:00`);

function label(k: string, dateLocale: string) {
  return dayMonth(k, dateLocale);
}

function colTitle(c: { date: string; counts: number[]; total: number }, lang: Lang, dateLocale: string) {
  const parts = PACE_BUCKETS.map((b, i) => b[lang] + " " + c.counts[i]).join(" · ");
  return `${label(c.date, dateLocale)}: ${c.total} · ${parts}`;
}

export default function BookingPace({ rows, today, lang, dateLocale }: { rows: StayRow[]; today: string; lang: Lang; dateLocale: string }) {
  const [range, setRange] = useState(90);
  const scroller = useRef<HTMLDivElement>(null);
  // On phones the scatter scrolls sideways; start at the most recent bookings.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [range]);
  const { days, points } = useMemo(() => bookingPace(rows, today, range), [rows, today, range]);
  const prev = useMemo(() => bookingPace(rows, format(addDays(day(today), -range), "yyyy-MM-dd"), range).points.length, [rows, today, range]);

  const step = range > 120 ? 7 : 1;
  const cols = useMemo(() => {
    const out: Array<{ date: string; counts: number[]; total: number }> = [];
    for (let i = 0; i < days.length; i += step) {
      const chunk = days.slice(i, i + step);
      out.push({ date: chunk[0].date, counts: PACE_BUCKETS.map((_, b) => chunk.reduce((a, d) => a + d.counts[b], 0)), total: chunk.reduce((a, d) => a + d.total, 0) });
    }
    return out;
  }, [days, step]);
  const maxCol = Math.max(1, ...cols.map((c) => c.total));
  const total = points.length;
  // The report loads ~400 days of stays, so only compare when the prior window fits.
  const change = prev && range * 2 <= HISTORY_DAYS ? Math.round(((total - prev) / prev) * 100) : null;
  const leads = points.map((p) => p.lead).sort((a, b) => a - b);
  const mid = Math.floor(leads.length / 2);
  const medianLead = leads.length ? (leads.length % 2 ? leads[mid] : Math.round((leads[mid - 1] + leads[mid]) / 2)) : null;

  const W = 800, H = 260, PAD = 34;
  const x0 = day(days[0]?.date ?? today);
  const yMin = x0;
  const checkIns = points.map((p) => day(p.checkIn));
  const yTop = checkIns.length ? new Date(Math.max(...checkIns.map((d) => +d), +addDays(day(today), 30))) : addDays(day(today), 90);
  const ySpan = Math.max(1, differenceInCalendarDays(yTop, yMin));
  const px = (k: string) => PAD + (differenceInCalendarDays(day(k), x0) / Math.max(1, range - 1)) * (W - PAD - 8);
  const py = (k: string) => H - PAD - (differenceInCalendarDays(day(k), yMin) / ySpan) * (H - PAD - 8);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => format(addDays(yMin, Math.round(f * ySpan)), "yyyy-MM-dd"));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => days[Math.min(days.length - 1, Math.round(f * (days.length - 1)))]?.date).filter(Boolean) as string[];

  return (
    <section className="min-w-0 rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-heading">{L(lang, "Ritmo de reservas", "Booking pace")}</h2>
          <p className="text-xs text-slate-500">
            {total} {L(lang, "reservas", "bookings")}
            {change != null ? <span className={change >= 0 ? "ml-1 font-semibold text-emerald-700" : "ml-1 font-semibold text-red-600"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}%</span> : null}
            {change != null ? ` ${L(lang, "vs período anterior", "vs prior period")}` : ""}
            {medianLead != null ? ` · ${L(lang, "anticipación mediana", "median lead")} ${medianLead} d` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)}
              className={`rounded px-2 py-1 text-xs font-semibold ${r === range ? "bg-heading text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {r} d
            </button>
          ))}
        </div>
      </div>

      <p className="mb-1 text-xs text-slate-500">{L(lang, step === 7 ? "Reservas hechas por semana" : "Reservas hechas por día", step === 7 ? "Bookings made per week" : "Bookings made per day")}</p>
      <div className="flex h-28 items-end gap-px">
        {cols.map((c) => (
          <div key={c.date} className="flex h-full min-w-0 flex-1 flex-col-reverse"
            title={colTitle(c, lang, dateLocale)}>
            {c.counts.map((n, b) => n ? <div key={b} style={{ height: `${(n / maxCol) * 100}%`, background: FILL[b] }} /> : null)}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {xTicks.map((t) => <span key={t}>{label(t, dateLocale)}</span>)}
      </div>

      <p className="mb-1 mt-4 text-xs text-slate-500">{L(lang, "Día de reserva → fecha de llegada (cada punto es una reserva; tamaño = noches)", "Booking day → check-in date (each dot is a booking; size = nights)")}</p>
      <div ref={scroller} className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label={L(lang, "Día de reserva contra fecha de llegada", "Booking day vs check-in date")}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD} x2={W - 8} y1={py(t)} y2={py(t)} stroke="#e2e8f0" />
            <text x={PAD - 4} y={py(t) + 3} fontSize="9" textAnchor="end" fill="#64748b">{label(t, dateLocale)}</text>
          </g>
        ))}
        {xTicks.map((t) => <text key={t} x={px(t)} y={H - PAD + 14} fontSize="9" textAnchor="middle" fill="#64748b">{label(t, dateLocale)}</text>)}
        <line x1={px(days[0]?.date ?? today)} y1={py(days[0]?.date ?? today)} x2={px(today)} y2={py(today)} stroke="#94a3b8" strokeDasharray="4 3" />
        {points.map((p) => (
          <circle key={p.id} cx={px(p.booked)} cy={py(p.checkIn)} r={2 + Math.min(p.nights, 14) / 3} fill={FILL[p.bucket]} fillOpacity={0.65} stroke="white" strokeWidth={0.5}>
            <title>{`${p.room}: ${L(lang, "reservada", "booked")} ${label(p.booked, dateLocale)} → ${L(lang, "llega", "arrives")} ${label(p.checkIn, dateLocale)} · ${p.nights} ${L(lang, "noches", "nights")} · ${p.lead} d`}</title>
          </circle>
        ))}
      </svg></div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
        {PACE_BUCKETS.map((b, i) => (
          <span key={b.en} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FILL[i] }} />{L(lang, "llega en", "arrives in")} {b[lang]}</span>
        ))}
        <span className="inline-flex items-center gap-1 text-slate-500"><span className="inline-block w-4 border-t border-dashed border-slate-400" />{L(lang, "mismo día", "same day")}</span>
      </div>
    </section>
  );
}
