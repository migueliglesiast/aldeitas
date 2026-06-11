import { getListingDetail } from "@/lib/data";
import ListingDetailBody from "@/components/ListingDetailBody";
import { prisma } from "@/lib/prisma";

export default async function ListingPage({ params }: { params: { id: string } }) {
  const listing = await getListingDetail(params.id);

  if (!listing) {
    return <div>Listing not found</div>;
  }

  return (
    <ListingDetailBody
      listing={{
        id: listing.id,
        title: listing.title,
        description: listing.description,
        descriptionEn: listing.descriptionEn,
        descriptionEs: listing.descriptionEs,
        nightlyBasePrice: listing.nightlyBasePrice,
        baseCurrency: listing.baseCurrency,
        hotel: {
          id: listing.hotel.id,
          location: listing.hotel.location,
        },
        images: listing.images,
      }}
    />
  );
}

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  try {
    const rows = await prisma.listing.findMany({ select: { id: true } });
    return rows.map((r) => ({ id: r.id }));
  } catch {
    return [];
  }
}
