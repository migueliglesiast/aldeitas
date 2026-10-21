"use client";
import { useState, useEffect } from "react";
import { useHotel } from "@/lib/hotel-context";
import { useLocale } from "@/lib/i18n/locale-context";
import { ADDON_UNIT_LABELS, addonLineTotal, type AddonUnit } from "@/lib/addon-units";

type GuestAddon = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  emoji: string | null;
  priceCents: number;
  currency: string;
  unit: AddonUnit;
  maxQuantity: number;
};

function redirectTo(url: string) {
  window.location.href = url;
}

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
  const [addons, setAddons] = useState<GuestAddon[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const { locale } = useLocale();
  const lang = locale === "en" ? "en" : "es";

  useEffect(() => {
    fetch(`/api/listings/${listingId}/addons`)
      .then((res) => (res.ok ? res.json() : { addons: [] }))
      .then((data: { addons?: GuestAddon[] }) => setAddons(Array.isArray(data.addons) ? data.addons : []))
      .catch(() => setAddons([]));
  }, [listingId]);

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
  const staysCents = pricing?.totalCents ?? (nights > 0 ? Math.round(nights * basePriceCents) : 0);
  const displayCurrency = pricing?.currency ?? currency;
  const offeredAddons = addons.filter((addon) => addon.currency === displayCurrency);
  const addonsCents = offeredAddons.reduce(
    (sum, addon) => sum + addonLineTotal(addon, picked[addon.id] ?? 0, nights),
    0
  );
  const totalCents = staysCents + addonsCents;
  const setQuantity = (addon: GuestAddon, quantity: number) =>
    setPicked((prev) => ({ ...prev, [addon.id]: Math.max(0, Math.min(addon.maxQuantity, quantity)) }));
  const nightlyCents = pricing?.nightlyCents ?? basePriceCents;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const selectedAddons = offeredAddons
        .filter((addon) => (picked[addon.id] ?? 0) > 0)
        .map((addon) => ({ addonId: addon.id, quantity: picked[addon.id] }));
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          start,
          end,
          email,
          phone,
          ...(selectedAddons.length > 0 ? { addons: selectedAddons } : {}),
        }),
      });
      let data: any = {};
      try {
        data = await response.json();
      } catch {
        const txt = await response.text();
        data = { error: txt || "Booking failed" };
      }
      if (!response.ok) throw new Error(data.error || "Booking failed");
      const redirectUrl = data.paymentUrl || data.checkoutUrl;
      if (redirectUrl) {
        redirectTo(redirectUrl);
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
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <p className="text-lg">
        <span className="font-semibold text-ink">${(nightlyCents / 100).toFixed(0)}</span>
        <span className="text-muted"> / night</span>
      </p>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-2 divide-x divide-line">
          <div className="space-y-0.5 p-3">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ink">Check-in</label>
            <input 
              type="date" 
              aria-label="Check-in"
              value={start} 
              onChange={(e) => handleStartChange(e.target.value)} 
              min={minDate}
              className="w-full bg-transparent text-sm text-ink focus:outline-none" 
              required 
            />
          </div>
          <div className="space-y-0.5 p-3">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ink">Check-out</label>
            <input 
              type="date" 
              aria-label="Check-out"
              value={end} 
              onChange={(e) => handleEndChange(e.target.value)} 
              min={getMinCheckoutDate()}
              disabled={!start}
              className="w-full bg-transparent text-sm text-ink focus:outline-none disabled:cursor-not-allowed disabled:text-muted" 
              required 
            />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-ink">Email</label>
        <input type="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm focus:border-ink focus:outline-none" required />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-ink">Phone</label>
        <input type="tel" aria-label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm focus:border-ink focus:outline-none" required />
      </div>
      {offeredAddons.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{lang === "en" ? "Add to your stay" : "Agrega a tu estancia"}</legend>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {offeredAddons.map((addon) => {
              const quantity = picked[addon.id] ?? 0;
              const name = lang === "en" && addon.nameEn ? addon.nameEn : addon.name;
              return (
                <li key={addon.id} className={`flex items-center gap-3 p-3 ${quantity > 0 ? "bg-brand/5" : ""}`}>
                  <span className="text-xl" aria-hidden>{addon.emoji || "✨"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{name}</div>
                    <div className="text-xs text-muted">
                      ${(addon.priceCents / 100).toFixed(0)} {ADDON_UNIT_LABELS[addon.unit][lang]}
                      {addon.description ? ` · ${addon.description}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" aria-label={`- ${name}`} disabled={quantity === 0} onClick={() => setQuantity(addon, quantity - 1)} className="h-7 w-7 rounded-full border border-line text-ink disabled:opacity-30">−</button>
                    <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">{quantity}</span>
                    <button type="button" aria-label={`+ ${name}`} disabled={quantity >= addon.maxQuantity} onClick={() => setQuantity(addon, quantity + 1)} className="h-7 w-7 rounded-full border border-line text-ink disabled:opacity-30">+</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      <div className="space-y-2 text-sm">
        {addonsCents > 0 && (
          <div className="flex items-center justify-between text-gray-600">
            <span>{lang === "en" ? "Add-ons" : "Extras"}</span>
            <span>${(addonsCents / 100).toFixed(2)} {displayCurrency}</span>
          </div>
        )}
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
      <button disabled={loading} className="w-full rounded-xl bg-brand py-3 font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
        {loading ? "Processing..." : "Reserve"}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}


