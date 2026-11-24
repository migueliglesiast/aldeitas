"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import type { StaySource } from "@/lib/hotel-stats";

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

const COPY = {
  es: {
    title: "Calendario de todas las reservas",
    note: "3 semanas · toca un cuarto para editar precios y bloqueos",
    legend: { aldeitas: "Aldeitas", airbnb: "Airbnb", vrbo: "Vrbo", blocked: "Bloqueado", ghost: "Estimada" },
    guests: (n: number) => `${n} huésp.`,
  },
  en: {
    title: "All reservations calendar",
    note: "3 weeks · tap a room to edit prices and blocks",
    legend: { aldeitas: "Aldeitas", airbnb: "Airbnb", vrbo: "Vrbo", blocked: "Blocked", ghost: "Estimated" },
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

function Grid({
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
                <span className="h-3 text-[9px] lowercase">{i === 0 || p.day === 1 ? p.month.replace(".", "") : ""}</span>
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
                {[...room.spans].sort((a, b) => Number(Boolean(a.bookingId)) - Number(Boolean(b.bookingId))).map((span) => {
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

/** Cross-hotel calendar: every room for the next 3 weeks, colored by channel, with free-night prices. */
export default function PortfolioCalendar({ hotels, days, todayKey }: { hotels: PanelHotel[]; days: string[]; todayKey: string }) {
  const { locale } = useLocale();
  const lang = locale === "es" ? "es" : "en";
  const t = COPY[lang];
  if (!days.length || !hotels.length) return null;
  const sources: StaySource[] = ["aldeitas", "airbnb", "vrbo", "blocked", "ghost"];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
          <p className="text-sm text-slate-600">{t.note}</p>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-slate-600">
          {sources.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${SOURCE_DOT[s]}`} />
              {t.legend[s]}
            </li>
          ))}
        </ul>
      </div>
      <Grid hotels={hotels} days={days} todayKey={todayKey} locale={lang} t={t} />
    </section>
  );
}
