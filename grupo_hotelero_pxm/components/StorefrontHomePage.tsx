import { getHotelDetail } from "@/lib/data";
import HotelDetailView from "@/components/HotelDetailView";
import { getStorefrontFromHeaders } from "@/lib/storefront";

export default async function StorefrontHomePage() {
  const storefront = await getStorefrontFromHeaders();
  if (!storefront) return null;

  const hotel = await getHotelDetail(storefront.id);
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
      storefront
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
