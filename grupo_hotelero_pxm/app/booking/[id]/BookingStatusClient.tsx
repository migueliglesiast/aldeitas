"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/currency";

type BookingStatusResponse = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELED";
  guestEmail: string;
  startDate: string;
  endDate: string;
  totalPriceCents: number;
  currency: string;
  authorizedAt: string | null;
  confirmedAt: string | null;
  pendingExpiresAt: string | null;
  cancelReason: string | null;
  isAwaitingPayment: boolean;
  isProcessing: boolean;
  paymentCaptured: boolean;
  message: string;
  reconcileMessage: string | null;
  listing: { id: string; title: string };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(booking: BookingStatusResponse) {
  if (booking.isAwaitingPayment) return "Awaiting payment";
  if (booking.isProcessing) return "Processing";
  if (booking.status === "CONFIRMED") return "Confirmed";
  if (booking.status === "CANCELED") return "Canceled";
  return booking.status;
}

export default function BookingStatusClient({ bookingId }: { bookingId: string }) {
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider");
  const orderId = searchParams.get("order_id");
  const [booking, setBooking] = useState<BookingStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusUrl = useMemo(() => {
    const query = new URLSearchParams();
    if (provider) query.set("provider", provider);
    if (orderId) query.set("order_id", orderId);
    const suffix = query.toString();
    return `/api/bookings/${bookingId}${suffix ? `?${suffix}` : ""}`;
  }, [bookingId, provider, orderId]);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch(statusUrl, { cache: "no-store" });
        let data: any = {};
        try {
          data = await response.json();
        } catch {
          const text = await response.text();
          throw new Error(text || "Invalid response from server");
        }
        if (!response.ok) {
          throw new Error(data.error || "Unable to load booking status");
        }
        if (active) {
          setBooking(data);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Unable to load booking status");
        }
      }
    }

    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [statusUrl]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl rounded border p-6 text-gray-600">
        Loading booking status...
      </div>
    );
  }

  const badgeClass =
    booking.status === "CONFIRMED"
      ? "bg-green-100 text-green-800"
      : booking.status === "CANCELED"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-900";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded border p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Your booking</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${badgeClass}`}>
            {statusLabel(booking)}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-gray-800">{booking.message}</p>
          {booking.reconcileMessage && (
            <p className="text-sm text-gray-500">{booking.reconcileMessage}</p>
          )}
        </div>

        <div className="rounded bg-gray-50 p-4 text-sm space-y-2">
          <div>
            <span className="font-medium">Property:</span> {booking.listing.title}
          </div>
          <div>
            <span className="font-medium">Dates:</span> {formatDate(booking.startDate)} to{" "}
            {formatDate(booking.endDate)}
          </div>
          <div>
            <span className="font-medium">Estimated total:</span>{" "}
            {formatMoney(booking.totalPriceCents, booking.currency)}
          </div>
          <div>
            <span className="font-medium">Guest email:</span> {booking.guestEmail}
          </div>
          <div>
            <span className="font-medium">Reference:</span> {booking.id}
          </div>
        </div>

        {booking.status === "CONFIRMED" && booking.confirmedAt && (
          <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            Confirmed on {formatDate(booking.confirmedAt)}.
          </div>
        )}

        {booking.status === "CANCELED" && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {booking.cancelReason ||
              "This booking could not be completed. No charge was captured."}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {booking.isAwaitingPayment && (
            <Link
              href={`/booking/${bookingId}/pay`}
              className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white hover:bg-[#008a86]"
            >
              Complete payment
            </Link>
          )}
          <Link
            href={`/listing/${booking.listing.id}`}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back to listing
          </Link>
          {booking.isProcessing && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white hover:bg-[#008a86]"
            >
              Refresh status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
