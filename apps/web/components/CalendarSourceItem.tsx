"use client";
import { useState, useEffect } from "react";

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
    <div className="rounded border p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium text-lg">{source.name}</div>
          <div className="text-sm text-gray-600 mt-1 break-all">{source.icalUrl}</div>
          {source.listing ? (
            <div className="text-sm text-gray-700 mt-2">
              <span className="font-medium">Linked to:</span> {source.listing.hotel.name} - {source.listing.title}
            </div>
          ) : (
            <div className="text-sm text-red-600 mt-2 font-medium">⚠️ Not linked to any listing</div>
          )}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {typeof source.createdAt === 'string' 
            ? new Date(source.createdAt).toLocaleDateString()
            : source.createdAt.toLocaleDateString()}
        </div>
      </div>
      
      {/* Update Link Section */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Link to Listing:
            </label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              disabled={updating}
            >
              <option value="">No listing (unlink)</option>
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
            className="rounded bg-[#00a19c] px-4 py-2 text-white text-sm hover:bg-[#008a86] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {updating ? "Updating..." : "Update Link"}
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

