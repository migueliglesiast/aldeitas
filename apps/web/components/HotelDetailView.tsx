"use client";

import Link from "next/link";
import HotelBrandHeader, { useHotelBrandPalette } from "@/components/HotelBrandHeader";
import FilteredListingGrid from "@/components/FilteredListingGrid";
import SearchForm from "@/components/SearchForm";
import { paletteToCssVars } from "@/lib/hotel-branding";
import { useLocale } from "@/lib/i18n/locale-context";
import LocalizedDescription from "@/components/LocalizedDescription";

type Listing = {
  id: string;
  title: string;
  nightlyBasePrice: number;
  baseCurrency: string;
  images: Array<{ id: string; url: string; position: number }>;
};

type Props = {
  hotel: {
    id: string;
    name: string;
    location: string;
    logoImageUrl: string | null;
    description: string;
    descriptionEn?: string | null;
    descriptionEs?: string | null;
  };
  listings: Listing[];
  storefront?: boolean;
};

export default function HotelDetailView({ hotel, listings, storefront = false }: Props) {
  const { t } = useLocale();
  const palette = useHotelBrandPalette(hotel.logoImageUrl);
  const brandStyle = paletteToCssVars(palette);

  return (
    <div className="space-y-6" style={brandStyle}>
      {!storefront ? (
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-white transition-colors duration-200"
            style={{ backgroundColor: "var(--hotel-brand-primary)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "var(--hotel-brand-accent)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "var(--hotel-brand-primary)";
            }}
          >
            {t("back")}
          </Link>
        </div>
      ) : null}

      {!storefront ? (
        <div
          className="rounded-2xl border p-5 md:p-6"
          style={{
            borderColor: "var(--hotel-brand-ring)",
            backgroundColor: "color-mix(in srgb, white 92%, var(--hotel-brand-muted))",
          }}
        >
          <HotelBrandHeader
            name={hotel.name}
            location={hotel.location}
            logoImageUrl={hotel.logoImageUrl}
            size="lg"
          />
          <LocalizedDescription item={hotel} className="mt-4 text-sm leading-relaxed md:text-base" />
        </div>
      ) : (
        <LocalizedDescription item={hotel} className="text-sm leading-relaxed md:text-base" />
      )}

      <div className="w-full">
        <SearchForm />
      </div>

      <FilteredListingGrid listings={listings} hotelName={hotel.name} />
    </div>
  );
}
