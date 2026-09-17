"use client";

import { useEffect, useState } from "react";

export function useListingBookedDates(listingId: string) {
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchAvailability() {
      try {
        setLoading(true);
        const response = await fetch(`/api/listings/${listingId}/availability`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Failed to fetch availability"
          );
        }
        if (active) {
          setBookedDates(new Set(data.bookedDates || []));
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load availability");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchAvailability();
    return () => {
      active = false;
    };
  }, [listingId]);

  return { bookedDates, loading, error };
}

export function rangeOverlapsBookedDates(
  checkIn: string,
  checkOut: string,
  bookedDates: Set<string>
) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const current = new Date(start);

  while (current < end) {
    const dateKey = current.toISOString().split("T")[0];
    if (bookedDates.has(dateKey)) {
      return true;
    }
    current.setDate(current.getDate() + 1);
  }

  return false;
}
