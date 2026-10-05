import { getHotelDetail } from "@/lib/data";
import type { StorefrontHotel } from "@/lib/storefront";
import StorefrontLanding from "@/components/storefront/StorefrontLanding";

export default async function StorefrontHomePage({ storefront }: { storefront: StorefrontHotel }) {
  const hotel = await getHotelDetail(storefront.id);
  if (!hotel) {
    return <div>Hotel not found</div>;
  }

  const listings = [...hotel.listings]
    .sort((a, b) => a.title.localeCompare(b.title, "es", { numeric: true }))
    .map((listing) => ({
      id: listing.id,
      title: listing.title,
      nightlyBasePrice: listing.nightlyBasePrice,
      baseCurrency: listing.baseCurrency,
      images: listing.images,
    }));

  return (
    <StorefrontLanding
      hotel={{
        name: hotel.name,
        location: hotel.location,
        logoImageUrl: hotel.logoImageUrl,
        storefrontTagline: hotel.storefrontTagline,
        description: hotel.description,
        descriptionEn: hotel.descriptionEn,
        descriptionEs: hotel.descriptionEs,
        googleMapsUrl: hotel.googleMapsUrl,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
      }}
      listings={listings}
    />
  );
}
