"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useHotel } from "@/lib/hotel-context";
import ImageCarousel from "./ImageCarousel";
import { ListingGridSkeleton } from "./Skeleton";

type ImageType = { id: string; url: string; position: number };
type Listing = { 
  id: string; 
  title: string; 
  nightlyBasePrice: number; 
  baseCurrency: string; 
  images: ImageType[];
};

type FilteredListingGridProps = {
  listings: Listing[];
  hotelName?: string;
};

export default function FilteredListingGrid({ listings, hotelName }: FilteredListingGridProps) {
  const { searchParams, hotelAvailability } = useHotel();
  const [listingAvailability, setListingAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Check availability for all listings when search params change
  useEffect(() => {
    if (searchParams && searchParams.checkIn && searchParams.checkOut) {
      setLoading(true);
      const checkAvailability = async () => {
        const availabilityMap: Record<string, boolean> = {};
        
        await Promise.all(
          listings.map(async (listing) => {
            try {
              const response = await fetch(
                `/api/listings/${listing.id}/availability?debug=false`
              );
              if (response.ok) {
                const data = await response.json();
                const bookedDates = new Set(data.bookedDates || []);
                
                // Check if the date range has any conflicts
                const checkIn = new Date(searchParams.checkIn);
                const checkOut = new Date(searchParams.checkOut);
                const current = new Date(checkIn);
                let hasConflict = false;
                
                while (current < checkOut && !hasConflict) {
                  const dateStr = current.toISOString().split('T')[0];
                  if (bookedDates.has(dateStr)) {
                    hasConflict = true;
                  }
                  current.setDate(current.getDate() + 1);
                }
                
                availabilityMap[listing.id] = !hasConflict;
              } else {
                // If we can't check, assume unavailable
                availabilityMap[listing.id] = false;
              }
            } catch (error) {
              console.error(`Error checking availability for ${listing.id}:`, error);
              availabilityMap[listing.id] = false;
            }
          })
        );
        
        setListingAvailability(availabilityMap);
        setLoading(false);
      };
      
      checkAvailability();
    } else {
      // No search params, show all listings
      setListingAvailability({});
      setLoading(false);
    }
  }, [searchParams, listings]);

  // Filter listings based on availability
  const filteredListings = useMemo(() => {
    if (!searchParams || !searchParams.checkIn || !searchParams.checkOut) {
      return listings; // Show all if no search
    }
    
    return listings.filter((listing) => {
      const isAvailable = listingAvailability[listing.id];
      return isAvailable === true; // Only show if explicitly available
    });
  }, [listings, searchParams, listingAvailability]);

  if (loading) {
    return <ListingGridSkeleton count={Math.min(Math.max(listings.length, 3), 6)} />;
  }

  if (filteredListings.length === 0 && searchParams && searchParams.checkIn && searchParams.checkOut) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="mb-2 font-semibold text-ink">
            No rooms available for the selected dates.
          </p>
          <p className="text-sm text-muted">
            Try adjusting your check-in or check-out dates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {filteredListings.map((l) => (
        <div key={l.id} className="group relative">
          <Link
            href={`/listing/${l.id}`}
            aria-label={`View ${l.title}`}
            className="absolute inset-0 z-[5] rounded-2xl"
          />
          <div className="relative aspect-[20/13] w-full overflow-hidden rounded-2xl bg-surface">
            {l.images?.length ? (
              <ImageCarousel
                images={l.images.map((img) => img.url)}
                alt={l.title}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface text-muted">
                No image yet
              </div>
            )}
          </div>
          <Link href={`/listing/${l.id}`} className="relative z-10 mt-3 block space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-semibold text-ink">{l.title}</p>
              <p className="shrink-0 text-sm font-semibold text-ink">${(l.nightlyBasePrice / 100).toFixed(0)}</p>
            </div>
            {hotelName && (
              <p className="text-sm text-muted">{hotelName}</p>
            )}
          </Link>
        </div>
      ))}
      {filteredListings.length === 0 && !searchParams && (
        <div className="text-muted col-span-full">No rooms listed yet.</div>
      )}
    </div>
  );
}

