import { getHotelDetail } from "@/lib/data";
import Link from "next/link";
import FilteredListingGrid from "@/components/FilteredListingGrid";
import SearchForm from "@/components/SearchForm";

export default async function HotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotel = await getHotelDetail(id);
  if (!hotel) {
    return <div>Hotel not found</div>;
  }

  // Serialize listings for client component
  const serializedListings = hotel.listings.map((l) => ({
    id: l.id,
    title: l.title,
    nightlyBasePrice: l.nightlyBasePrice,
    baseCurrency: l.baseCurrency,
    images: l.images,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface">
          ← Back
        </Link>
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">{hotel.name}</h1>
        <p className="text-muted">{hotel.location}</p>
      </div>

      {/* Search Form - shows selected dates if any */}
      <div className="sticky top-[64px] z-40 -mx-4 px-4 py-2 md:-mx-6 md:px-6">
        <div className="mx-auto max-w-4xl">
          <SearchForm />
        </div>
      </div>

      {/* Filtered Listings Grid */}
      <FilteredListingGrid listings={serializedListings} hotelName={hotel.name} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
