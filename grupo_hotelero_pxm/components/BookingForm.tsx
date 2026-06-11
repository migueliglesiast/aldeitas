"use client";
import { useState, useEffect } from "react";
import { useHotel } from "@/lib/hotel-context";
import { useLocale } from "@/lib/i18n/locale-context";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import {
  rangeOverlapsBookedDates,
  useListingBookedDates,
} from "@/hooks/useListingBookedDates";
import { formatMoney } from "@/lib/currency";

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

type PaymentProviderId = "conekta" | "mercadopago";

export default function BookingForm({ listingId, basePriceCents, currency }: Props) {
  const { searchParams, setSearchParams } = useHotel();
  const { t } = useLocale();
  const [start, setStart] = useState<string>(searchParams?.checkIn || "");
  const [end, setEnd] = useState<string>(searchParams?.checkOut || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [providers, setProviders] = useState<PaymentProviderId[]>([]);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderId>("mercadopago");
  const { bookedDates } = useListingBookedDates(listingId);

  useEffect(() => {
    fetch("/api/payment-providers")
      .then((res) => res.json())
      .then((data) => {
        const available = (data.providers || []) as PaymentProviderId[];
        setProviders(available);
        if (available.length > 0) {
          setPaymentProvider(available[0]);
        }
      })
      .catch(() => setProviders([]));
  }, []);

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

  function formatDisplayDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const rangeUnavailable =
    start && end ? rangeOverlapsBookedDates(start, end, bookedDates) : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!start || !end) {
      setMessage(t("selectDatesOnCalendar"));
      setLoading(false);
      return;
    }

    if (rangeOverlapsBookedDates(start, end, bookedDates)) {
      setMessage(t("datesUnavailable"));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          start,
          end,
          email,
          phone,
          paymentProvider: providers.length > 0 ? paymentProvider : undefined,
        }),
      });
      let data: any = {};
      try {
        data = await response.json();
      } catch {
        const txt = await response.text();
        data = { error: txt || t("bookingFailed") };
      }
      if (!response.ok) throw new Error(data.error || t("bookingFailed"));
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.paymentPageUrl) {
        window.location.href = data.paymentPageUrl;
      } else if (data.statusUrl) {
        window.location.href = data.statusUrl;
      } else {
        setMessage(data.message || t("bookingCreated"));
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  const nights =
    start && end
      ? Math.max(
          0,
          Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))
        )
      : 0;

  const totalCents = pricing?.totalCents ?? (nights > 0 ? Math.round(nights * basePriceCents) : 0);
  const displayCurrency = pricing?.currency ?? currency;
  const nightlyCents = pricing?.nightlyCents ?? basePriceCents;

  return (
    <form onSubmit={submit} className="space-y-4 rounded border p-4">
      <AvailabilityCalendar listingId={listingId} compact monthsToShow={14} />

      <div className="rounded bg-gray-50 px-3 py-2 text-sm">
        {start && end ? (
          <div className="space-y-1">
            <div>
              <span className="font-medium">{t("checkInLabel")}:</span> {formatDisplayDate(start)}
            </div>
            <div>
              <span className="font-medium">{t("checkOutLabel")}:</span> {formatDisplayDate(end)}
            </div>
            {rangeUnavailable && (
              <p className="text-red-600">{t("datesUnavailable")}</p>
            )}
          </div>
        ) : (
          <p className="text-gray-600">{t("selectDatesOnCalendar")}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-sm">{t("email")}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">{t("phone")}</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>
      {providers.length > 1 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{t("paymentMethod")}</label>
          {providers.includes("conekta") && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="paymentProvider"
                value="conekta"
                checked={paymentProvider === "conekta"}
                onChange={() => setPaymentProvider("conekta")}
              />
              {t("payWithConekta")}
            </label>
          )}
          {providers.includes("mercadopago") && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="paymentProvider"
                value="mercadopago"
                checked={paymentProvider === "mercadopago"}
                onChange={() => setPaymentProvider("mercadopago")}
              />
              {t("payWithMercadoPago")}
            </label>
          )}
        </div>
      )}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-gray-600">
          <span>
            {nights} {nights === 1 ? t("night") : t("nights")}
          </span>
          {loadingPricing ? (
            <span className="text-gray-400">{t("calculating")}</span>
          ) : pricing ? (
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                {formatMoney(totalCents, displayCurrency)}
              </div>
              {pricing.isDynamic && (
                <div className="text-xs text-gray-500">
                  {formatMoney(nightlyCents, displayCurrency)}/{t("night")}
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-600">
              {formatMoney(totalCents, displayCurrency)}
            </span>
          )}
        </div>
        {pricing && pricing.isDynamic && pricing.nightlyCents !== pricing.basePriceCents && (
          <div className="border-t pt-1 text-xs text-gray-500">
            {t("baseRate")}: {formatMoney(pricing.basePriceCents, pricing.baseCurrency)}/{t("night")}
          </div>
        )}
      </div>
      <button
        disabled={loading || !start || !end || rangeUnavailable}
        className="w-full rounded bg-[#00a19c] py-2 text-white hover:bg-[#008a86] disabled:opacity-50"
      >
        {loading ? t("processing") : t("reserve")}
      </button>
      <p className="text-xs text-gray-500">{t("cardNotice")}</p>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}
