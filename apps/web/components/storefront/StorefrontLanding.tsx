"use client";

import Image from "next/image";
import FilteredListingGrid from "@/components/FilteredListingGrid";
import LocalizedDescription from "@/components/LocalizedDescription";
import SearchForm from "@/components/SearchForm";
import { useLocale } from "@/lib/i18n/locale-context";

type Listing = {
  id: string;
  title: string;
  nightlyBasePrice: number;
  baseCurrency: string;
  images: Array<{ id: string; url: string; position: number }>;
};

type Props = {
  hotel: {
    name: string;
    location: string;
    logoImageUrl: string | null;
    storefrontTagline: string | null;
    description: string;
    descriptionEn: string | null;
    descriptionEs: string | null;
    googleMapsUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  listings: Listing[];
};

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.6-7-11a7 7 0 1114 0c0 5.4-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

const PERK_ICONS = {
  price: "M12 6v12m-3-2.8c.6.9 1.7 1.3 3 1.3 1.9 0 3-1 3-2.3 0-3.2-6-1.7-6-4.8 0-1.3 1.2-2.2 3-2.2 1.2 0 2.3.4 2.9 1.2",
  payment: "M3 7h18v10H3zM3 11h18M7 15h3",
  calendar: "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zm4 9l2 2 4-4",
} as const;

function Perk({ icon, title, body }: { icon: keyof typeof PERK_ICONS; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-line/80 bg-card p-6 shadow-pill">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d={PERK_ICONS[icon]} />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-heading">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function directionsUrl(hotel: Props["hotel"]) {
  const destination =
    hotel.latitude != null && hotel.longitude != null
      ? `${hotel.latitude},${hotel.longitude}`
      : `${hotel.name} ${hotel.location}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export default function StorefrontLanding({ hotel, listings }: Props) {
  const { t, locale } = useLocale();
  const tagline = locale === "es" ? hotel.storefrontTagline : null;
  const embedMap = hotel.googleMapsUrl?.includes("/maps/embed") ? hotel.googleMapsUrl : null;

  return (
    <div className="space-y-16 md:space-y-20">
      <section className="space-y-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-2 pt-2 text-center">
          {hotel.logoImageUrl ? (
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-brand/15 md:h-36 md:w-36">
              <Image
                src={hotel.logoImageUrl}
                alt={`${hotel.name} logo`}
                fill
                priority
                sizes="144px"
                className="object-contain"
              />
            </div>
          ) : null}
          <h1 className="mt-5 text-balance font-poster text-[2rem] font-black leading-[1.08] tracking-tight text-brand sm:text-4xl md:text-5xl">
            {hotel.name}
          </h1>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-muted md:text-base">
            <PinIcon className="h-4 w-4 text-brand" />
            <span>{hotel.location}</span>
            <span aria-hidden>·</span>
            <a href="#rooms" className="underline-offset-2 hover:text-ink hover:underline">
              {t("storefrontRoomCount", { count: listings.length })}
            </a>
          </p>
        </div>
        <div className="sticky top-[64px] z-40 -mx-4 px-4 py-2 md:-mx-6 md:px-6">
          <div className="mx-auto max-w-4xl">
            <SearchForm />
          </div>
        </div>
      </section>

      <section id="rooms" className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold tracking-tight text-heading md:text-3xl">
            {t("storefrontRoomsTitle")}
          </h2>
          <p className="text-muted">{t("storefrontRoomsLead")}</p>
        </div>
        <FilteredListingGrid listings={listings} />
      </section>

      <section id="stay" className="space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-tight text-heading md:text-3xl">
          {t("perksTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <Perk icon="price" title={t("perkPriceTitle")} body={t("perkPriceBody")} />
          <Perk icon="payment" title={t("perkPaymentTitle")} body={t("perkPaymentBody")} />
          <Perk icon="calendar" title={t("perkCalendarTitle")} body={t("perkCalendarBody")} />
        </div>
      </section>

      <section id="location" className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-center">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="font-display text-2xl font-bold tracking-tight text-heading md:text-3xl">
            {t("locationTitle")}
          </h2>
          {tagline ? (
            <p className="text-lg leading-8 text-ink">{tagline}</p>
          ) : (
            <LocalizedDescription item={hotel} className="text-lg leading-8 text-ink" />
          )}
          <p className="flex items-center gap-2 text-muted">
            <PinIcon className="h-4 w-4 text-brand" />
            {hotel.location}, Puerto Escondido, Oaxaca
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={directionsUrl(hotel)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              {t("getDirections")}
            </a>
            <a
              href="#rooms"
              className="inline-flex items-center gap-2 rounded-full border border-brand/40 px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
            >
              {t("seeAllRooms")}
            </a>
          </div>
        </div>
        {embedMap ? (
          <div className="overflow-hidden rounded-3xl border border-line shadow-card lg:col-span-3">
            <iframe
              src={embedMap}
              title={`${hotel.name} map`}
              className="h-[320px] w-full md:h-[400px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
