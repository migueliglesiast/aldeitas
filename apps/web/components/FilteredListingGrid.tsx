"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useHotel } from "@/lib/hotel-context";

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
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-full text-center py-8 text-gray-500">
          Checking availability...
        </div>
      </div>
    );
  }

  if (filteredListings.length === 0 && searchParams && searchParams.checkIn && searchParams.checkOut) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-gray-600 mb-2">
            No rooms available for the selected dates.
          </p>
          <p className="text-sm text-gray-500">
            Try adjusting your check-in or check-out dates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {filteredListings.map((l) => (
        <Link key={l.id} href={`/listing/${l.id}`} className="group rounded border hover:shadow transition-shadow">
          <div className="relative h-44 w-full overflow-hidden rounded-t">
            {l.images?.[0] ? (
              <Image 
                src={l.images[0].url} 
                alt={l.title} 
                fill 
                className="object-cover transition-transform group-hover:scale-105" 
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                No image yet
              </div>
            )}
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{l.title}</p>
              <p className="text-sm text-gray-500">${(l.nightlyBasePrice / 100).toFixed(0)}</p>
            </div>
            {hotelName && (
              <p className="text-sm text-gray-600 mt-1">{hotelName}</p>
            )}
          </div>
        </Link>
      ))}
      {filteredListings.length === 0 && !searchParams && (
        <div className="text-gray-600 col-span-full">No rooms listed yet.</div>
      )}
    </div>
  );
}

