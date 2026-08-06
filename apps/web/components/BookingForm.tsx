"use client";
import { useState, useEffect } from "react";
import { useHotel } from "@/lib/hotel-context";

type Props = {
  listingId: string;
  basePriceCents: number;
  currency: string;
};

type PricingData = {
  nights: number;
  nightlyCents: number;
  totalCents: number;
  currency: string;
  basePriceCents: number;
  baseCurrency: string;
  isDynamic: boolean;
};

export default function BookingForm({ listingId, basePriceCents, currency }: Props) {
  const { searchParams, setSearchParams } = useHotel();
  const [start, setStart] = useState<string>(searchParams?.checkIn || "");
  const [end, setEnd] = useState<string>(searchParams?.checkOut || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // Update dates when search params change (from calendar or external source)
  useEffect(() => {
    if (searchParams?.checkIn) {
      setStart(searchParams.checkIn);
    } else if (!searchParams) {
      setStart("");
    }
    if (searchParams?.checkOut && searchParams.checkOut.trim() !== "") {
      setEnd(searchParams.checkOut);
    } else {
      setEnd("");
    }
  }, [searchParams]);

  // Fetch pricing when dates change
  useEffect(() => {
    if (start && end) {
      setLoadingPricing(true);
      fetch(`/api/listings/${listingId}/pricing?checkIn=${start}&checkOut=${end}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error("Error fetching pricing:", data.error);
            setPricing(null);
          } else {
            setPricing(data);
          }
        })
        .catch((error) => {
          console.error("Error fetching pricing:", error);
          setPricing(null);
        })
        .finally(() => {
          setLoadingPricing(false);
        });
    } else {
      setPricing(null);
    }
  }, [start, end, listingId]);

  const minDate = new Date().toISOString().split('T')[0];
  
  const getMinCheckoutDate = () => {
    if (!start) return minDate;
    const checkInDate = new Date(start);
    checkInDate.setDate(checkInDate.getDate() + 1);
    return checkInDate.toISOString().split('T')[0];
  };

  const handleStartChange = (value: string) => {
    setStart(value);
    // Clear check-out if it's before the new check-in
    if (end && value && new Date(end) <= new Date(value)) {
      setEnd("");
    }
    // Update context when form dates change
    if (value) {
      setSearchParams({
        checkIn: value,
        checkOut: end && new Date(end) > new Date(value) ? end : "",
        guests: searchParams?.guests || 1,
        pets: searchParams?.pets || 0,
      });
    } else {
      // If check-in is cleared, clear the context
      setSearchParams(null);
    }
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    // Update context when form dates change
    if (value && start) {
      setSearchParams({
        checkIn: start,
        checkOut: value,
        guests: searchParams?.guests || 1,
        pets: searchParams?.pets || 0,
      });
    } else if (start) {
      // If check-out is cleared but check-in exists, update context with just check-in
      setSearchParams({
        checkIn: start,
        checkOut: "",
        guests: searchParams?.guests || 1,
        pets: searchParams?.pets || 0,
      });
    }
  };

  const nights = start && end 
    ? Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  
  // Use pricing from API if available, otherwise calculate from base price
  const totalCents = pricing?.totalCents ?? (nights > 0 ? Math.round(nights * basePriceCents) : 0);
  const displayCurrency = pricing?.currency ?? currency;
  const nightlyCents = pricing?.nightlyCents ?? basePriceCents;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, start, end, email, phone }),
      });
      let data: any = {};
      try {
        data = await response.json();
      } catch {
        const txt = await response.text();
        data = { error: txt || "Booking failed" };
      }
      if (!response.ok) throw new Error(data.error || "Booking failed");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setMessage("Booking created.");
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded border p-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Check-in</label>
        <input 
          type="date" 
          aria-label="Check-in"
          value={start} 
          onChange={(e) => handleStartChange(e.target.value)} 
          min={minDate}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]" 
          required 
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Check-out</label>
        <input 
          type="date" 
          aria-label="Check-out"
          value={end} 
          onChange={(e) => handleEndChange(e.target.value)} 
          min={getMinCheckoutDate()}
          disabled={!start}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c] disabled:bg-gray-100 disabled:cursor-not-allowed" 
          required 
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">Email</label>
        <input type="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border px-3 py-2" required />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">Phone</label>
        <input type="tel" aria-label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border px-3 py-2" required />
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-gray-600">
          <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>
          {loadingPricing ? (
            <span className="text-gray-400">Calculating...</span>
          ) : pricing ? (
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                ${(totalCents / 100).toFixed(2)} {displayCurrency}
              </div>
              {pricing.isDynamic && (
                <div className="text-xs text-gray-500">
                  ${(nightlyCents / 100).toFixed(2)}/night
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-600">
              ${(totalCents / 100).toFixed(2)} {displayCurrency}
            </span>
          )}
        </div>
        {pricing && pricing.isDynamic && pricing.nightlyCents !== pricing.basePriceCents && (
          <div className="text-xs text-gray-500 pt-1 border-t">
            Base rate: ${(pricing.basePriceCents / 100).toFixed(2)}/night
          </div>
        )}
      </div>
      <button disabled={loading} className="w-full rounded bg-[#00a19c] py-2 text-white hover:bg-[#008a86] disabled:opacity-50">
        {loading ? "Processing..." : "Reserve"}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}


