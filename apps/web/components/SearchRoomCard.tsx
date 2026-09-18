"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ImageCarousel from "./ImageCarousel";
import {
  DEFAULT_HOTEL_PALETTE,
  extractBrandPalette,
  paletteToCardStyle,
  type HotelBrandPalette,
} from "@/lib/hotel-branding";
import { getHotelLogoCandidates } from "@/lib/hotel-cover";

type ImageType = { id: string; url: string; position: number };

export type SearchRoomCardProps = {
  id: string;
  title: string;
  nightlyBasePrice: number;
  images: ImageType[];
  hotelName: string;
  hotelCoverImageUrl?: string | null;
  hotelLogoImageUrl?: string | null;
};

function useResolvedLogoSrc(
  hotelName: string,
  coverImageUrl?: string | null,
  logoImageUrl?: string | null
) {
  const candidates = getHotelLogoCandidates({
    name: hotelName,
    coverImageUrl,
    logoImageUrl,
  });
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const src =
    !failed && index < candidates.length
      ? candidates[index]
      : "/images/aldeitas_logo.png";

  return {
    src,
    onError: () => {
      if (index + 1 < candidates.length) setIndex((i) => i + 1);
      else setFailed(true);
    },
    isFallback: failed || index >= candidates.length,
  };
}

/**
 * Availability search result: room photo + price, hotel logo/name at the bottom,
 * container wash derived from the hotel logo palette.
 */
export default function SearchRoomCard({
  id,
  title,
  nightlyBasePrice,
  images,
  hotelName,
  hotelCoverImageUrl,
  hotelLogoImageUrl,
}: SearchRoomCardProps) {
  const logo = useResolvedLogoSrc(hotelName, hotelCoverImageUrl, hotelLogoImageUrl);
  const [palette, setPalette] = useState<HotelBrandPalette>(DEFAULT_HOTEL_PALETTE);

  useEffect(() => {
    if (logo.isFallback) {
      setPalette(DEFAULT_HOTEL_PALETTE);
      return;
    }
    let cancelled = false;
    extractBrandPalette(logo.src).then((next) => {
      if (!cancelled) setPalette(next);
    });
    return () => {
      cancelled = true;
    };
  }, [logo.src, logo.isFallback]);

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-card"
      style={paletteToCardStyle(palette)}
    >
      <Link
        href={`/listing/${id}`}
        aria-label={`View ${title} at ${hotelName}`}
        className="absolute inset-0 z-[5] rounded-2xl"
      />

      <div className="relative aspect-[20/13] w-full overflow-hidden bg-surface">
        {images?.length ? (
          <ImageCarousel
            images={images.map((img) => img.url)}
            alt={title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface text-sm text-muted">
            No image yet
          </div>
        )}
      </div>

      <div className="relative z-10 space-y-3 px-3.5 pb-3.5 pt-3">
        <Link href={`/listing/${id}`} className="block">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold text-ink">{title}</p>
            <p className="shrink-0 text-sm font-semibold text-ink">
              ${(nightlyBasePrice / 100).toFixed(0)}
              <span className="font-normal text-muted"> / night</span>
            </p>
          </div>
        </Link>

        <div
          className="flex items-center gap-2.5 border-t pt-3"
          style={{ borderColor: palette.ring }}
        >
          <span
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-white"
            style={{ borderColor: palette.ring }}
            aria-hidden
          >
            <Image
              src={logo.src}
              alt=""
              fill
              sizes="36px"
              className={
                logo.isFallback ? "object-contain p-1.5 opacity-70" : "object-cover"
              }
              onError={logo.onError}
            />
          </span>
          <p
            className="min-w-0 truncate text-sm font-semibold tracking-tight"
            style={{ color: palette.primary }}
          >
            {hotelName}
          </p>
        </div>
      </div>
    </article>
  );
}
