"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/currency";

type AdminBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELED";
  guestEmail: string;
  guestPhone: string;
  startDate: string;
  endDate: string;
  totalPriceCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentOrderId: string | null;
  authorizedAt: string | null;
  confirmedAt: string | null;
  pendingExpiresAt: string | null;
  cancelReason: string | null;
  lastReconciledAt: string | null;
  createdAt: string;
  isAwaitingPayment: boolean;
  isProcessing: boolean;
  paymentState: "awaiting_payment" | "authorized" | "captured" | "released";
  statusLabel: string;
  statusUrl: string;
  listing: {
    id: string;
    title: string;
    hotel: { id: string; name: string };
  };
};

type Summary = {
  total: number;
  awaitingPayment: number;
  processing: number;
  confirmed: number;
  canceled: number;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate).toLocaleDateString();
  const end = new Date(endDate).toLocaleDateString();
  return `${start} → ${end}`;
}

function statusBadgeClass(booking: AdminBooking) {
  if (booking.isAwaitingPayment || booking.isProcessing) {
    return "bg-amber-100 text-amber-900";
  }
  if (booking.status === "CONFIRMED") {
    return "bg-green-100 text-green-800";
  }
  return "bg-red-100 text-red-800";
}

export default function AdminBookingsPanel() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/bookings", { cache: "no-store" });
      let data: any = {};
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || "Invalid response from server");
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load bookings");
      }
      setBookings(data.bookings);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function reconcile(bookingId?: string) {
    setReconciling(true);
    setMessage(null);
    setError(null);
    try {
      const query = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
      const response = await fetch(`/api/admin/bookings/reconcile${query}`, {
        method: "POST",
      });
      let data: any = {};
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || "Invalid response from server");
      }
      if (!response.ok) {
        throw new Error(data.error || "Reconcile failed");
      }

      const confirmed = data.results.filter((r: { action: string }) => r.action === "confirmed").length;
      const canceled = data.results.filter((r: { action: string }) => r.action === "canceled").length;
      const pending = data.results.filter((r: { action: string }) => r.action === "pending").length;

      setMessage(
        `Reconcile complete: ${confirmed} confirmed, ${canceled} canceled, ${pending} still pending.`
      );
      await loadBookings();
    } catch (err: any) {
      setError(err.message || "Reconcile failed");
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor pending, confirmed, and canceled direct bookings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadBookings}
            disabled={loading || reconciling}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => reconcile()}
            disabled={loading || reconciling}
            className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white hover:bg-[#008a86] disabled:opacity-50"
          >
            {reconciling ? "Reconciling..." : "Reconcile pending"}
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Awaiting payment" value={summary.awaitingPayment} />
          <SummaryCard label="Processing" value={summary.processing} />
          <SummaryCard label="Confirmed" value={summary.confirmed} />
          <SummaryCard label="Canceled" value={summary.canceled} />
        </div>
      )}

      {message && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded border p-6 text-gray-600">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="rounded border p-6 text-center text-gray-500">
          No bookings yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((booking) => (
                <tr key={booking.id} className="align-top">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(booking)}`}
                    >
                      {booking.statusLabel}
                    </span>
                    {booking.cancelReason && (
                      <p className="mt-2 max-w-xs text-xs text-gray-500">{booking.cancelReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{booking.listing.title}</div>
                    <div className="text-gray-500">{booking.listing.hotel.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{booking.guestEmail}</div>
                    <div className="text-gray-500">{booking.guestPhone}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateRange(booking.startDate, booking.endDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatMoney(booking.totalPriceCents, booking.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="capitalize">{booking.paymentState.replace("_", " ")}</div>
                    {booking.paymentProvider && booking.paymentOrderId && (
                      <div className="text-xs text-gray-500">
                        {booking.paymentProvider} · {booking.paymentOrderId}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <div>Created: {formatDate(booking.createdAt)}</div>
                    {booking.authorizedAt && <div>Authorized: {formatDate(booking.authorizedAt)}</div>}
                    {booking.confirmedAt && <div>Confirmed: {formatDate(booking.confirmedAt)}</div>}
                    {booking.lastReconciledAt && (
                      <div>Reconciled: {formatDate(booking.lastReconciledAt)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={booking.statusUrl}
                        className="text-[#00a19c] hover:underline"
                      >
                        Guest view
                      </Link>
                      {booking.isProcessing && (
                        <button
                          type="button"
                          onClick={() => reconcile(booking.id)}
                          disabled={reconciling}
                          className="text-left text-xs text-gray-700 hover:underline disabled:opacity-50"
                        >
                          Reconcile
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
