"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input placeholder="Search location or title" value={query} onChange={(e) => setQuery(e.target.value)} className="rounded border px-3 py-2 sm:col-span-2" />
        <input placeholder="Min $/night" value={min} onChange={(e) => setMin(e.target.value)} className="rounded border px-3 py-2" />
        <input placeholder="Max $/night" value={max} onChange={(e) => setMax(e.target.value)} className="rounded border px-3 py-2" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <Link href={`/listing/${l.id}`} key={l.id} className="group rounded border hover:shadow">
            <div className="relative h-44 w-full overflow-hidden rounded-t">
              {l.images?.[0] ? (
                <Image src={l.images[0].url} alt={l.title} fill className="object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">No image yet</div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{l.title}</p>
                <p className="text-sm text-gray-500">from ${(l.nightlyBasePrice / 100).toFixed(0)} {l.baseCurrency}</p>
              </div>
              <p className="text-sm text-gray-600">{l.hotel.location}</p>
            </div>
          </Link>
        ))}
        {listings.length === 0 && (
          <div className="text-gray-600">No results. Adjust filters.</div>
        )}
      </div>
    </div>
  );
}


