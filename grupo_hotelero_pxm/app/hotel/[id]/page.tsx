import { getHotelDetail } from "@/lib/data";
import HotelDetailView from "@/components/HotelDetailView";

export default async function HotelPage({ params }: { params: { id: string } }) {
  const hotel = await getHotelDetail(params.id);
  if (!hotel) {
    return <div>Hotel not found</div>;
  }

  const serializedListings = hotel.listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    nightlyBasePrice: listing.nightlyBasePrice,
    baseCurrency: listing.baseCurrency,
    images: listing.images,
  }));

  return (
    <HotelDetailView
      hotel={{
        id: hotel.id,
        name: hotel.name,
        location: hotel.location,
        logoImageUrl: hotel.logoImageUrl,
        description: hotel.description,
        descriptionEn: hotel.descriptionEn,
        descriptionEs: hotel.descriptionEs,
      }}
      listings={serializedListings}
    />
  );
}

export const dynamic = "force-dynamic";
