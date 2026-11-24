"use client";
import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n/locale-context";

function feedLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("airbnb")) return "Airbnb";
    if (host.includes("booking.com")) return "Booking.com";
    if (host.includes("guesty")) return "Guesty";
    if (host.includes("vrbo")) return "Vrbo";
    return host;
  } catch {
    return url.slice(0, 30);
  }
}

type Listing = { id: string; title: string; hotel: { name: string } };

type CalendarSource = {
  id: string;
  name: string;
  icalUrl: string;
  listingId: string | null;
  createdAt: Date | string;
  listing: {
    id: string;
    title: string;
    hotel: { name: string };
  } | null;
};

export default function CalendarSourceItem({ source }: { source: CalendarSource }) {
  const { locale, dateLocale } = useLocale();
  const es = locale === "es";
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>(source.listingId || "");
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/listings")
      .then((res) => res.json())
      .then((data) => setListings(data))
      .catch(() => setListings([]));
  }, []);

  async function updateLink() {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: source.name,
          icalUrl: source.icalUrl,
          listingId: selectedListingId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setMessage("Updated successfully");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium">{source.name}</div>
          <div className="mt-1 text-sm text-gray-600">{es ? "Calendario de" : "Calendar from"} {feedLabel(source.icalUrl)}</div>
          {source.listing ? (
            <div className="text-sm text-gray-700 mt-2">
              <span className="font-medium">{es ? "Bloquea:" : "Blocks:"}</span> {source.listing.hotel.name} - {source.listing.title}
            </div>
          ) : (
            <div className="text-sm text-red-600 mt-2 font-medium">{es ? "No está ligado a ningún cuarto" : "Not linked to any room"}</div>
          )}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {typeof source.createdAt === 'string' 
            ? new Date(source.createdAt).toLocaleDateString(dateLocale)
            : source.createdAt.toLocaleDateString(dateLocale)}
        </div>
      </div>
      
      {/* Update Link Section */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {es ? "Cuarto que bloquea" : "Room it blocks"}
            </label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              disabled={updating}
            >
              <option value="">{es ? "Ningún cuarto (desligar)" : "No room (unlink)"}</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.hotel.name} - {l.title}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={updateLink}
            disabled={updating || selectedListingId === (source.listingId || "")}
            className="rounded-xl bg-brand px-4 py-2 text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {updating ? (es ? "Guardando…" : "Saving…") : es ? "Guardar" : "Save"}
          </button>
        </div>
        {message && (
          <div className={`text-xs mt-2 ${message.includes("error") || message.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

