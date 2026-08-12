"use client";
import { useState, useEffect } from "react";

type Listing = { id: string; title: string; hotel: { name: string } };

export default function CalendarForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [listingId, setListingId] = useState<string>("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/listings")
      .then((res) => res.json())
      .then((data) => setListings(data))
      .catch(() => setListings([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icalUrl: url, listingId: listingId || null }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        const txt = await res.text();
        data = { error: txt || "Failed to add" };
      }
      if (!res.ok) throw new Error(data.error || "Failed to add");
      setMessage("Added");
      setName("");
      setUrl("");
      setListingId("");
      window.location.reload();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded border p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium">Name (e.g., &quot;Guesty Calendar - Room 1&quot;)</label>
        <input className="w-full rounded border px-3 py-2 mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium">iCal URL (Airbnb, Guesty or Booking.com)</label>
        <input
          className="w-full rounded border px-3 py-2 mt-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.guesty.com/ical/... or https://www.airbnb.com/calendar/ical/..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Link to Listing (Optional)</label>
        <select
          className="w-full rounded border px-3 py-2 mt-1"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        >
          <option value="">No listing (general calendar)</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.hotel.name} - {l.title}
            </option>
          ))}
        </select>
      </div>
      <button disabled={loading} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
        {loading ? "Adding..." : "Add Calendar"}
      </button>
      {message && <div className={`text-sm ${message.includes("error") || message.includes("Failed") ? "text-red-600" : "text-green-600"}`}>{message}</div>}
    </form>
  );
}
