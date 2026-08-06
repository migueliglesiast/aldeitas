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
  const serializedListings = hotel.listings.map(l => ({
    id: l.id,
    title: l.title,
    nightlyBasePrice: l.nightlyBasePrice,
    baseCurrency: l.baseCurrency,
    images: l.images,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 rounded bg-[#00a19c] px-3 py-2 text-white hover:bg-[#008a86]">
          ← Back
        </Link>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{hotel.name}</h1>
        <p className="text-gray-600">{hotel.location}</p>
      </div>
      
      {/* Search Form - shows selected dates if any */}
      <div className="w-full">
        <SearchForm />
      </div>
      
      {/* Filtered Listings Grid */}
      <FilteredListingGrid listings={serializedListings} hotelName={hotel.name} />
    </div>
  );
}

export const dynamic = 'force-dynamic';


