import { getListingDetail } from "@/lib/data";
import Image from "next/image";
import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { prisma } from "@/lib/prisma";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListingDetail(id);

  if (!listing) {
    return <div>Listing not found</div>;
  }

  const [mainImage, ...secondaryImages] = listing.images;

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">{listing.title}</h1>
        <p className="text-muted">
          {listing.hotel.name ? `${listing.hotel.name} · ` : ""}{listing.hotel.location}
        </p>
      </div>

      {/* Airbnb-style photo gallery: one large photo + grid of secondary photos */}
      {listing.images.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 overflow-hidden rounded-3xl md:grid-cols-2">
          <div className="relative aspect-[4/3] w-full md:aspect-auto md:h-full md:min-h-[420px]">
            <Image
              src={mainImage.url}
              alt={listing.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          {secondaryImages.length > 0 && (
            <div className={`grid h-full grid-cols-2 gap-2 ${secondaryImages.length > 2 ? "grid-rows-2" : ""}`}>
              {secondaryImages.slice(0, 4).map((img, i) => (
                <div key={img.id} className="relative h-full min-h-[200px] w-full">
                  <Image
                    src={img.url}
                    alt={`${listing.title} photo ${i + 2}`}
                    fill
                    sizes="25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl bg-surface p-12 text-center text-muted">Images coming soon</div>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-4 border-b border-line/70 pb-8">
            <h2 className="font-display text-xl font-bold text-ink">About this place</h2>
            {listing.description ? (
              <p className="whitespace-pre-line leading-relaxed text-ink/90">{listing.description}</p>
            ) : (
              <p className="text-muted">Description coming soon.</p>
            )}
          </div>

          {/* Availability Calendar */}
          <AvailabilityCalendar listingId={listing.id} monthsToShow={6} />
        </div>
        <div>
          <div className="lg:sticky lg:top-24">
            <BookingForm listingId={listing.id} basePriceCents={listing.nightlyBasePrice} currency={listing.baseCurrency} />
            <p className="mt-4 text-center text-sm text-muted">
              <Link href={`/hotel/${listing.hotel.id}`} className="underline underline-offset-2 hover:text-ink">
                See more rooms at {listing.hotel.name}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Make this route dynamic to handle any listing ID at runtime
export const dynamic = 'force-dynamic';

// Optional: Still pre-generate common listings for better performance
export async function generateStaticParams() {
  try {
    const listings = await prisma.listing.findMany({ select: { id: true } });
    return listings.map((l) => ({ id: l.id }));
  } catch {
    return [];
  }
}
