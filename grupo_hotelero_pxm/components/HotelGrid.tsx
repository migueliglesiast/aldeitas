"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type ImageType = { id: string; url: string; position: number };
type Listing = { id: string; title: string; nightlyBasePrice: number; baseCurrency: string; images: ImageType[] };
type Hotel = { id: string; name: string; description: string; location: string; listings: Listing[] };

export default function HotelGrid({ hotels }: { hotels: Hotel[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return hotels.filter((h) => !q || `${h.name} ${h.location}`.toLowerCase().includes(q));
  }, [hotels, query]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input placeholder="Search location or hotel" value={query} onChange={(e) => setQuery(e.target.value)} className="rounded border px-3 py-2 sm:col-span-2" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((h) => {
          const firstImage = h.listings?.[0]?.images?.[0];
          const rooms = h.listings?.length ?? 0;
          const minPrice = h.listings?.length ? Math.min(...h.listings.map((l) => l.nightlyBasePrice)) : null;
          return (
            <Link href={`/hotel/${h.id}`} key={h.id} className="group rounded border hover:shadow">
              <div className="relative h-44 w-full overflow-hidden rounded-t">
                {firstImage ? (
                  <Image src={firstImage.url} alt={h.name} fill className="object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">No image yet</div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{h.name}</p>
                  {minPrice !== null && <p className="text-sm text-gray-500">from ${(minPrice / 100).toFixed(0)}</p>}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <p>{h.location}</p>
                  <p>
                    {rooms} room{rooms === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && <div className="text-gray-600">No results. Adjust filters.</div>}
      </div>
    </div>
  );
}


