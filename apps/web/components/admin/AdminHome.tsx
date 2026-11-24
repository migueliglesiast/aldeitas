"use client";

import Link from "next/link";
import CoverImageWithFallback from "@/components/CoverImageWithFallback";
import { useLocale } from "@/lib/i18n/locale-context";
import { dayMonth } from "@/lib/booking-performance";
import { OPEN_STEP_EVENT } from "@/components/onboarding/OwnerOnboarding";
import { isActiveHotel as isActive, type AdminOverview, type HotelOverview, type OverviewStay } from "@/lib/admin-overview";

type Lang = "es" | "en";
const L = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);
const money = (cents: number) => `MX$${Math.round(cents / 100).toLocaleString("es-MX")}`;

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold text-heading sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function StayList({ stays, empty, lang, dateLocale, today, showDate }: {
  stays: OverviewStay[]; empty: string; lang: Lang; dateLocale: string; today: string; showDate?: boolean;
}) {
  if (!stays.length) return <p className="py-3 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {stays.map((s, i) => (
        <li key={`${s.hotelId}-${s.roomTitle}-${s.start}-${i}`} className="flex items-center gap-3 py-2.5">
          {showDate ? (
            <span className={`w-16 shrink-0 rounded-md px-2 py-1 text-center text-sm font-semibold ${s.start === today ? "bg-aldeitas text-white" : "bg-slate-100 text-slate-700"}`}>
              {s.start === today ? L(lang, "Hoy", "Today") : dayMonth(s.start, dateLocale)}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{s.guestName || (s.channel === "airbnb" ? L(lang, "Huésped de Airbnb", "Airbnb guest") : L(lang, "Huésped", "Guest"))}</p>
            <p className="truncate text-sm text-slate-600">{s.roomTitle} · {s.hotelName}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.channel === "airbnb" ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-800"}`}>
            {s.channel === "airbnb" ? "Airbnb" : "Aldeitas"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function todos(h: HotelOverview, lang: Lang) {
  const out: Array<{ text: string; href?: string }> = [];
  if (h.pendingPayments) out.push({ text: L(lang, `${h.pendingPayments} pago(s) por confirmar`, `${h.pendingPayments} payment(s) to confirm`), href: "/admin/bookings" });
  if (h.rooms && h.syncedRooms < h.rooms) out.push({ text: L(lang, `${h.rooms - h.syncedRooms} de ${h.rooms} cuartos sin calendario de Airbnb`, `${h.rooms - h.syncedRooms} of ${h.rooms} rooms without an Airbnb calendar`), href: "/admin/calendars" });
  if (!h.payoutsReady) out.push({ text: L(lang, "Falta cuenta para recibir pagos", "Payout account missing") });
  if (!h.gmailConnected) out.push({ text: L(lang, "Gmail no conectado (reservas de Airbnb)", "Gmail not connected (Airbnb bookings)"), href: `/admin/hotel/${h.id}?tab=maintenance` });
  return out;
}

function occColor(pct: number) {
  if (pct >= 60) return "bg-emerald-500";
  if (pct >= 30) return "bg-amber-400";
  return "bg-rose-400";
}

function HotelCard({ h, lang }: { h: HotelOverview; lang: Lang }) {
  const pending = todos(h, lang);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <Link href={`/admin/hotel/${h.id}`} className="group block">
        <CoverImageWithFallback candidates={h.covers} alt={h.name} heightClassName="h-32" imageClassName="object-cover transition-transform group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{h.name}</h3>
          <p className="text-sm text-slate-600">
            {h.location} · {h.rooms} {h.rooms === 1 ? L(lang, "cuarto", "room") : L(lang, "cuartos", "rooms")}
          </p>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-600">{L(lang, "Reservado, próximos 30 días", "Booked, next 30 days")}</span>
            <span className="text-lg font-semibold text-heading">{h.occupancy30}%</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" role="presentation">
            <div className={`h-full rounded-full ${occColor(h.occupancy30)}`} style={{ width: `${Math.min(100, h.occupancy30)}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 px-1 py-2">
            <dt className="text-xs text-slate-600">{L(lang, "Ocupados hoy", "Occupied today")}</dt>
            <dd className="text-lg font-semibold">{h.inHouse}/{h.rooms}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-1 py-2">
            <dt className="text-xs text-slate-600">{L(lang, "Llegan hoy", "Arriving today")}</dt>
            <dd className="text-lg font-semibold">{h.arrivalsToday}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-1 py-2">
            <dt className="text-xs text-slate-600">{L(lang, "Salen hoy", "Leaving today")}</dt>
            <dd className="text-lg font-semibold">{h.departuresToday}</dd>
          </div>
        </dl>
        {h.payout30Cents > 0 ? (
          <p className="text-sm text-slate-600">
            {L(lang, "Ingresos esperados, próximos 30 días:", "Expected income, next 30 days:")}{" "}
            <span className="font-semibold text-slate-900">{money(h.payout30Cents)}</span>
          </p>
        ) : null}
        {pending.length ? (
          <ul className="space-y-1">
            {pending.map((p) => (
              <li key={p.text}>
                {p.href ? (
                  <Link href={p.href} className="flex items-center gap-2 text-sm text-amber-800 hover:underline">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    {p.text}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent(OPEN_STEP_EVENT, { detail: "payouts" }))}
                    className="flex items-center gap-2 text-left text-sm text-amber-800 hover:underline"
                  >
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    {p.text}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
            {L(lang, "Todo configurado", "All set up")}
          </p>
        )}
        <div className="mt-auto grid grid-cols-3 gap-2 pt-1">
          <Link href={`/admin/hotel/${h.id}?tab=calendar`} className="rounded-lg bg-aldeitas px-2 py-2 text-center text-sm font-semibold text-white hover:bg-[#007c89]">
            {L(lang, "Calendario", "Calendar")}
          </Link>
          <Link href={`/admin/hotel/${h.id}/performance`} className="rounded-lg bg-heading px-2 py-2 text-center text-sm font-semibold text-white hover:bg-ink">
            {L(lang, "Rendimiento", "Performance")}
          </Link>
          <Link href={`/admin/hotel/${h.id}?tab=general`} className="rounded-lg border border-slate-300 px-2 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50">
            {L(lang, "Editar", "Edit")}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function AdminHome({ name, overview, tourButton, nicknameEditor, calendar }: {
  name: string;
  overview: AdminOverview;
  tourButton: React.ReactNode;
  nicknameEditor: React.ReactNode;
  /** Cross-hotel calendar, streamed in between the summary and the arrival lists. */
  calendar?: React.ReactNode;
}) {
  const { locale, dateLocale } = useLocale();
  const lang: Lang = locale === "es" ? "es" : "en";
  const { hotels, arrivals, departures, today } = overview;
  const active = hotels.filter(isActive);
  const idle = hotels.filter((h) => !isActive(h));
  const rooms = active.reduce((a, h) => a + h.rooms, 0);
  const inHouse = active.reduce((a, h) => a + h.inHouse, 0);
  const totalNights = active.reduce((a, h) => a + h.rooms * h.occupancy30, 0);
  const occupancy = rooms ? Math.round(totalNights / rooms) : 0;
  const payout = hotels.reduce((a, h) => a + h.payout30Cents, 0);
  const arrivalsToday = arrivals.filter((s) => s.start === today);
  const longDate = new Date(`${today}T12:00:00`).toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" });
  const todayLabel = longDate.charAt(0).toUpperCase() + longDate.slice(1);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{todayLabel}</p>
          <h1 className="text-3xl font-semibold text-heading">{L(lang, `Hola, ${name}`, `Hi, ${name}`)}</h1>
          <p className="mt-1 text-slate-600">{L(lang, "Así van tus hoteles hoy.", "Here's how your hotels are doing today.")}</p>
        </div>
        {tourButton}
      </header>

      {nicknameEditor}

      {hotels.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
          {L(lang, "Todavía no tienes hoteles asignados.", "No hotels assigned to your account yet.")}
        </div>
      ) : (
        <>
          <section aria-label={L(lang, "Resumen", "Summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={L(lang, "Cuartos ocupados hoy", "Rooms occupied today")} value={`${inHouse} / ${rooms}`} />
            <Stat label={L(lang, "Llegadas hoy", "Arrivals today")} value={arrivalsToday.length} hint={L(lang, `${departures.length} salidas hoy`, `${departures.length} check-outs today`)} />
            <Stat label={L(lang, "Reservado, próximos 30 días", "Booked, next 30 days")} value={`${occupancy}%`} hint={L(lang, `${rooms} cuartos en ${active.length} hoteles activos`, `${rooms} rooms in ${active.length} active hotels`)} />
            <Stat label={L(lang, "Ingresos esperados, 30 días", "Expected income, 30 days")} value={money(payout)} hint={L(lang, "Reservas de Aldeitas y Airbnb", "Aldeitas and Airbnb bookings")} />
          </section>

          {calendar}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">{L(lang, "Llegadas, próximos 7 días", "Arrivals, next 7 days")}</h2>
              <StayList stays={arrivals.slice(0, 8)} empty={L(lang, "No hay llegadas esta semana.", "No arrivals this week.")} lang={lang} dateLocale={dateLocale} today={today} showDate />
              {arrivals.length > 8 ? (
                <p className="pt-2 text-sm text-slate-500">{L(lang, `y ${arrivals.length - 8} más`, `and ${arrivals.length - 8} more`)}</p>
              ) : null}
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">{L(lang, "Salidas hoy (limpieza)", "Check-outs today (cleaning)")}</h2>
              <StayList stays={departures} empty={L(lang, "Nadie sale hoy.", "No check-outs today.")} lang={lang} dateLocale={dateLocale} today={today} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-heading">{L(lang, "Tus hoteles", "Your hotels")}</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((h) => (
                <HotelCard key={h.id} h={h} lang={lang} />
              ))}
            </div>
          </section>

          {idle.length ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">{L(lang, "Hoteles por activar", "Hotels to activate")}</h2>
              <p className="text-sm text-slate-600">
                {L(lang, "Sin calendarios conectados ni reservas todavía. Conecta sus calendarios de Airbnb para empezar.", "No connected calendars or bookings yet. Connect their Airbnb calendars to get started.")}
              </p>
              <ul className="mt-3 divide-y divide-slate-100">
                {idle.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-medium text-slate-900">{h.name}</span>{" "}
                      <span className="text-sm text-slate-600">· {h.location} · {h.rooms} {h.rooms === 1 ? L(lang, "cuarto", "room") : L(lang, "cuartos", "rooms")}</span>
                    </span>
                    <span className="flex gap-2">
                      <Link href="/admin/calendars" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
                        {L(lang, "Conectar calendarios", "Connect calendars")}
                      </Link>
                      <Link href={`/admin/hotel/${h.id}?tab=general`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
                        {L(lang, "Editar", "Edit")}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
