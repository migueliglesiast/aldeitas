import { getListingDetail } from "@/lib/data";
import Image from "next/image";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { prisma } from "@/lib/prisma";

export default async function ListingPage({ params }: { params: { id: string } }) {
  const listing = await getListingDetail(params.id);

  if (!listing) {
    return <div>Listing not found</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {listing.images.length > 0 ? (
              listing.images.map((img) => (
                <div key={img.id} className="relative h-64 w-full">
                  <Image src={img.url} alt={listing.title} fill className="object-cover rounded" />
                </div>
              ))
            ) : (
              <div className="rounded bg-gray-100 p-6 text-gray-500">Images coming soon</div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{listing.title}</h1>
            <p className="text-gray-600">{listing.hotel.location}</p>
            {listing.description && (
              <p className="mt-4 text-gray-700 whitespace-pre-line">{listing.description}</p>
            )}
          </div>
        </div>
        <div>
          <BookingForm listingId={listing.id} basePriceCents={listing.nightlyBasePrice} currency={listing.baseCurrency} />
        </div>
      </div>
      
      {/* Availability Calendar */}
      <div className="border-t pt-8">
        <AvailabilityCalendar listingId={listing.id} monthsToShow={6} />
      </div>
    </div>
  );
}

// Make this route dynamic to handle any listing ID at runtime
export const dynamic = 'force-dynamic';

// Optional: Still pre-generate common listings for better performance
export async function generateStaticParams() {
  try {
    const rows = await prisma.listing.findMany({ select: { id: true } });
    return rows.map((r) => ({ id: r.id }));
  } catch (error) {
    // If database is not available at build time, return empty array
    // The route will still work dynamically at runtime
    return [];
  }
}


