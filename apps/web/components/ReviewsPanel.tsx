"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { ReviewCategory, ReviewInsights, ReviewTopic } from "@/lib/review-insights";

type Lang = "es" | "en";

const TOPIC: Record<Lang, Record<ReviewTopic, { label: string; tip: string }>> = {
  es: {
    cleanliness: { label: "Limpieza", tip: "Refuerza la limpieza de salida: polvo, olores y manchas." },
    maintenance: { label: "Mantenimiento", tip: "Haz una ronda de mantenimiento: fugas, humedad y piezas rotas." },
    hotWater: { label: "Agua caliente", tip: "Revisa el calentador y la presión del agua antes de cada llegada." },
    cooling: { label: "Aire / calor", tip: "Da servicio a los aires y ventiladores, sobre todo en los cuartos altos." },
    wifi: { label: "WiFi", tip: "Mejora el WiFi (repetidor o mejor plan) y deja la clave a la vista." },
    noise: { label: "Ruido", tip: "Menciona el ruido en el anuncio y fija horas de silencio." },
    bugs: { label: "Insectos", tip: "Programa fumigación y revisa mosquiteros y repelente." },
    amenities: { label: "Básicos", tip: "Completa lo básico: toallas, almohadas, ganchos y utensilios." },
    access: { label: "Acceso", tip: "Explica escaleras y camino en el anuncio y en el mensaje de llegada." },
    parking: { label: "Estacionamiento", tip: "Aclara en el anuncio dónde estacionarse." },
    accuracy: { label: "Expectativas", tip: "Ajusta fotos y descripción (p. ej. áreas compartidas) para evitar sorpresas." },
    privacy: { label: "Privacidad", tip: "Añade cortinas o separaciones donde falte privacidad." },
  },
  en: {
    cleanliness: { label: "Cleanliness", tip: "Tighten turnover cleaning: dust, smells and stains." },
    maintenance: { label: "Maintenance", tip: "Do a maintenance round: leaks, damp and broken fixtures." },
    hotWater: { label: "Hot water", tip: "Check the water heater and pressure before each arrival." },
    cooling: { label: "AC / heat", tip: "Service the AC units and fans, especially in upper rooms." },
    wifi: { label: "WiFi", tip: "Boost the WiFi (extender or better plan) and display the password." },
    noise: { label: "Noise", tip: "Mention noise in the listing and set quiet hours." },
    bugs: { label: "Bugs", tip: "Schedule pest control and check screens and repellent." },
    amenities: { label: "Basics", tip: "Restock basics: towels, pillows, hangers and utensils." },
    access: { label: "Access", tip: "Explain stairs and the path in the listing and arrival message." },
    parking: { label: "Parking", tip: "Say clearly in the listing where to park." },
    accuracy: { label: "Expectations", tip: "Align photos and description (e.g. shared areas) to avoid surprises." },
    privacy: { label: "Privacy", tip: "Add curtains or screens where privacy is lacking." },
  },
};

const CATEGORY: Record<Lang, Record<ReviewCategory, { label: string; tip: string }>> = {
  es: {
    cleanliness: { label: "Limpieza", tip: "La limpieza es tu nota más baja: revisa la lista de salida." },
    accuracy: { label: "Veracidad", tip: "La veracidad es tu nota más baja: actualiza fotos y descripción." },
    checkin: { label: "Llegada", tip: "La llegada es tu nota más baja: manda instrucciones claras un día antes." },
    communication: { label: "Comunicación", tip: "La comunicación es tu nota más baja: responde más rápido." },
    location: { label: "Ubicación", tip: "La ubicación es tu nota más baja: destaca lo que hay cerca en la bienvenida." },
    value: { label: "Calidad-precio", tip: "Calidad-precio es tu nota más baja: revisa precio o añade un detalle de bienvenida." },
  },
  en: {
    cleanliness: { label: "Cleanliness", tip: "Cleanliness is your lowest score: review the turnover checklist." },
    accuracy: { label: "Accuracy", tip: "Accuracy is your lowest score: refresh photos and description." },
    checkin: { label: "Check-in", tip: "Check-in is your lowest score: send clear instructions a day ahead." },
    communication: { label: "Communication", tip: "Communication is your lowest score: reply faster." },
    location: { label: "Location", tip: "Location is your lowest score: highlight what's nearby in the welcome." },
    value: { label: "Value", tip: "Value is your lowest score: review pricing or add a welcome touch." },
  },
};

const COPY = {
  es: {
    title: "Reseñas",
    note: "Reseñas públicas de Airbnb · se actualizan cada 12 horas",
    overall: "Calificación general",
    reviews: "reseñas",
    fiveShare: "Reseñas de 5 estrellas",
    ofLast: (n: number) => `de las últimas ${n}`,
    trend: "Últimos 90 días",
    vsBefore: (v: string) => `antes ${v}`,
    noRecent: "sin reseñas recientes",
    weakest: "Nota más baja",
    distribution: "Estrellas por reseña",
    distNote: (n: number) => `Últimas ${n} reseñas`,
    noStars: "Airbnb no muestra la calificación de cada reseña para este anuncio.",
    categories: "Calificación por categoría",
    catNote: "Promedio de todos los cuartos, la más baja primero",
    improve: "Qué mejorar",
    improveNote: "Temas que los huéspedes mencionan en sus reseñas",
    staffImprove: "Qué cuidar en cada limpieza",
    mentions: (n: number) => (n === 1 ? "1 reseña" : `${n} reseñas`),
    allGood: "Las reseñas recientes no señalan problemas concretos. Mantén el estándar.",
    rooms: "Por cuarto",
    roomsNote: "La más baja primero",
    clean: "limpieza",
    cleanSub: "Promedio en Airbnb, de 5",
    latest: "Últimas reseñas",
    review: "Reseña",
  },
  en: {
    title: "Reviews",
    note: "Public Airbnb reviews · refreshed every 12 hours",
    overall: "Overall rating",
    reviews: "reviews",
    fiveShare: "5-star reviews",
    ofLast: (n: number) => `of the last ${n}`,
    trend: "Last 90 days",
    vsBefore: (v: string) => `before ${v}`,
    noRecent: "no recent reviews",
    weakest: "Lowest score",
    distribution: "Stars per review",
    distNote: (n: number) => `Last ${n} reviews`,
    noStars: "Airbnb doesn't show each review's rating for this listing.",
    categories: "Rating by category",
    catNote: "Average across rooms, lowest first",
    improve: "What to improve",
    improveNote: "Topics guests bring up in their reviews",
    staffImprove: "What to watch at every turnover",
    mentions: (n: number) => (n === 1 ? "1 review" : `${n} reviews`),
    allGood: "Recent reviews don't point to specific problems. Keep the standard.",
    rooms: "By room",
    roomsNote: "Lowest first",
    clean: "cleanliness",
    cleanSub: "Airbnb average, out of 5",
    latest: "Latest reviews",
    review: "Review",
  },
};

const noopSubscribe = () => () => {};

const STAFF_TOPICS: ReadonlySet<ReviewTopic> = new Set(["cleanliness", "maintenance", "hotWater", "cooling", "bugs", "amenities", "wifi"]);

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  const cls = size === "lg" ? "text-lg sm:text-xl" : "text-xs sm:text-sm";
  return (
    <span className={`relative inline-block leading-none tracking-[0.12em] ${cls}`} aria-label={`${value.toFixed(1)} / 5`}>
      <span className="text-line">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-bronze" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5 ${className}`}>{children}</section>;
}

function CardTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3 sm:mb-4">
      <h3 className="text-sm font-semibold text-heading">{children}</h3>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-3 sm:p-5">
      <p className="text-[11px] leading-tight text-muted sm:text-xs">{label}</p>
      <div className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-heading sm:text-3xl">{children}</div>
      {sub ? <div className="mt-1 text-[11px] text-muted sm:text-xs">{sub}</div> : null}
    </div>
  );
}

const fmt = (n: number) => n.toFixed(2);

/** Review stars, rating breakdown, improvement tips and the three latest reviews. `staff` limits tips to turnover topics. */
export default function ReviewsPanel({ insights, staff = false }: { insights: ReviewInsights; staff?: boolean }) {
  const { locale: userLocale } = useLocale();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const lang: Lang = hydrated && userLocale === "en" ? "en" : "es";
  const t = COPY[lang];
  const dateFmt = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });

  const weakest = insights.categories[0];
  const cleanliness = insights.categories.find((c) => c.key === "cleanliness");
  const ratedCount = insights.distribution.reduce((s, d) => s + d.count, 0);
  const maxDist = Math.max(1, ...insights.distribution.map((d) => d.count));
  const trendDelta =
    insights.recentAvg != null && insights.priorAvg != null ? insights.recentAvg - insights.priorAvg : null;
  const issues = insights.issues.filter((i) => !staff || STAFF_TOPICS.has(i.topic));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="pt-2 sm:pt-4">
        <h2 className="text-base font-semibold text-heading sm:text-xl">{t.title}</h2>
        <p className="text-xs text-muted">{t.note}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Tile
          label={t.overall}
          sub={`${insights.reviewCount} ${t.reviews}`}
        >
          {insights.overall != null ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              {fmt(insights.overall)}
              <Stars value={insights.overall} size="lg" />
            </span>
          ) : (
            "—"
          )}
        </Tile>
        <Tile label={t.fiveShare} sub={ratedCount ? t.ofLast(ratedCount) : t.noStars}>
          {insights.fiveStarShare != null ? `${Math.round(insights.fiveStarShare * 100)}%` : "—"}
        </Tile>
        <Tile
          label={t.trend}
          sub={
            insights.recentAvg == null
              ? t.noRecent
              : insights.priorAvg != null
                ? t.vsBefore(fmt(insights.priorAvg))
                : t.mentions(insights.recentCount)
          }
        >
          {insights.recentAvg != null ? (
            <span className="flex items-baseline gap-2">
              {fmt(insights.recentAvg)}
              {trendDelta != null && Math.abs(trendDelta) >= 0.01 ? (
                <span className={`text-sm font-medium ${trendDelta > 0 ? "text-aldeitas" : "text-bronze"}`}>
                  {trendDelta > 0 ? "▲" : "▼"} {Math.abs(trendDelta).toFixed(2)}
                </span>
              ) : null}
            </span>
          ) : (
            "—"
          )}
        </Tile>
        {staff ? (
          <Tile label={CATEGORY[lang].cleanliness.label} sub={t.cleanSub}>
            {cleanliness ? cleanliness.rating.toFixed(1) : "—"}
          </Tile>
        ) : (
          <Tile label={t.weakest} sub={weakest ? CATEGORY[lang][weakest.key].label : undefined}>
            {weakest ? weakest.rating.toFixed(1) : "—"}
          </Tile>
        )}
      </div>

      <Card className="border-aldeitas/30 bg-card">
        <CardTitle note={t.improveNote}>{staff ? t.staffImprove : t.improve}</CardTitle>
        {issues.length ? (
          <ol className="space-y-3">
            {issues.map((issue, index) => (
              <li key={issue.topic} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aldeitas text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-heading">{TOPIC[lang][issue.topic].label}</span>
                    <span className="text-muted"> · {t.mentions(issue.mentions)}</span>
                  </p>
                  <p className="text-sm text-ink">{TOPIC[lang][issue.topic].tip}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs italic text-muted">“{issue.quote}”</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink">{t.allGood}</p>
        )}
        {!staff && weakest && weakest.rating < 4.9 ? (
          <p className="mt-3 border-t border-black/[0.06] pt-3 text-sm text-ink">{CATEGORY[lang][weakest.key].tip}</p>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle note={ratedCount ? t.distNote(ratedCount) : undefined}>{t.distribution}</CardTitle>
          {insights.hasStars ? (
            <ul className="space-y-1.5">
              {insights.distribution.map((d) => (
                <li key={d.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 tabular-nums text-heading">{d.stars}★</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                    <span
                      className={`block h-full rounded-full ${d.stars >= 4 ? "bg-aldeitas" : "bg-bronze"}`}
                      style={{ width: `${(d.count / maxDist) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums text-muted">{d.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.noStars}</p>
          )}
        </Card>

        <Card>
          <CardTitle note={t.catNote}>{t.categories}</CardTitle>
          <ul className="space-y-1.5">
            {insights.categories.map((c, index) => (
              <li key={c.key} className="flex items-center gap-2 text-xs">
                <span className={`w-24 shrink-0 truncate ${index === 0 ? "font-semibold text-heading" : "text-ink"}`}>
                  {CATEGORY[lang][c.key].label}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                  <span
                    className={`block h-full rounded-full ${index === 0 ? "bg-bronze" : "bg-aldeitas"}`}
                    style={{ width: `${Math.max(4, ((c.rating - 4) / 1) * 100)}%` }}
                  />
                </span>
                <span className="w-7 shrink-0 text-right tabular-nums text-heading">{c.rating.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle note={t.roomsNote}>{t.rooms}</CardTitle>
          <ul className="divide-y divide-black/[0.06]">
            {insights.rooms.map((room) => (
              <li key={room.title} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-ink">{room.title}</p>
                  <p className="text-[11px] text-muted">
                    {room.reviewCount} {t.reviews}
                    {room.cleanliness != null ? ` · ${t.clean} ${room.cleanliness.toFixed(1)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-medium text-heading">
                  {room.overall != null ? `${room.overall.toFixed(2)} ★` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {insights.latest.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-heading">{t.latest}</h3>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            {insights.latest.map((review) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between gap-2">
                  {review.rating != null ? (
                    <Stars value={review.rating} />
                  ) : (
                    <span className="text-xs font-medium text-muted">{t.review}</span>
                  )}
                  <span className="text-[11px] text-muted">{dateFmt.format(new Date(review.reviewedAt))}</span>
                </div>
                <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-ink">{review.comments}</p>
                <p className="mt-2 text-[11px] text-muted">
                  {review.reviewerName ? `${review.reviewerName} · ` : ""}
                  {review.roomTitle}
                </p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
