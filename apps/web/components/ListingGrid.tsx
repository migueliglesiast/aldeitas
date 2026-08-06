"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import ImageCarousel from "./ImageCarousel";

type ImageType = { id: string; url: string; position: number };
type Listing = { id: string; title: string; nightlyBasePrice: number; baseCurrency: string; images: ImageType[] };
type Hotel = { id: string; name: string; description: string; location: string; listings: Listing[] };

export default function ListingGrid({ hotels }: { hotels: Hotel[] }) {
  const [query, setQuery] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const listings = useMemo(() => {
    const flat: (Listing & { hotel: Omit<Hotel, "listings"> })[] = [];
    for (const h of hotels) {
      for (const l of h.listings) flat.push({ ...l, hotel: { id: h.id, name: h.name, description: h.description, location: h.location } });
    }
    const q = query.toLowerCase();
    const minVal = min ? Number(min) * 100 : null;
    const maxVal = max ? Number(max) * 100 : null;
    return flat.filter((l) => {
      const textMatch = !q || `${l.title} ${l.hotel.name} ${l.hotel.location}`.toLowerCase().includes(q);
      const price = l.nightlyBasePrice;
      const minOk = minVal === null || price >= minVal;
      const maxOk = maxVal === null || price <= maxVal;
      return textMatch && minOk && maxOk;
    });
  }, [hotels, query, min, max]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          placeholder="Search location or title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-full border border-line px-4 py-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none sm:col-span-2"
        />
        <input
          placeholder="Min $/night"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="rounded-full border border-line px-4 py-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
        />
        <input
          placeholder="Max $/night"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="rounded-full border border-line px-4 py-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <div key={l.id} className="group relative">
            <Link
              href={`/listing/${l.id}`}
              aria-label={`View ${l.title}`}
              className="absolute inset-0 z-[5] rounded-2xl"
            />
            <div className="relative aspect-[20/13] w-full overflow-hidden rounded-2xl bg-surface">
              {l.images?.length ? (
                <ImageCarousel
                  images={l.images.map((img) => img.url)}
                  alt={l.title}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface text-muted">No image yet</div>
              )}
            </div>
            <Link href={`/listing/${l.id}`} className="relative z-10 mt-3 block space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold text-ink">{l.title}</p>
                <p className="shrink-0 text-sm font-semibold text-ink">from ${(l.nightlyBasePrice / 100).toFixed(0)} {l.baseCurrency}</p>
              </div>
              <p className="text-sm text-muted">{l.hotel.location}</p>
            </Link>
          </div>
        ))}
        {listings.length === 0 && (
          <div className="col-span-full text-muted">No results. Adjust filters.</div>
        )}
      </div>
    </div>
  );
}
