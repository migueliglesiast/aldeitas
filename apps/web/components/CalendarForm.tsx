"use client";
import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n/locale-context";

type Listing = { id: string; title: string; hotel: { name: string } };

export default function CalendarForm() {
  const es = useLocale().locale === "es";
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
      setMessage(es ? "Agregado" : "Added");
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
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <div>
        <label className="block text-sm font-medium">{es ? "Nombre (ej. \"Airbnb - Cuarto 1\")" : "Name (e.g. \"Airbnb - Room 1\")"}</label>
        <input className="w-full rounded border px-3 py-2 mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium">{es ? "Enlace del calendario (iCal) de Airbnb, Booking.com o Guesty" : "Calendar link (iCal) from Airbnb, Booking.com or Guesty"}</label>
        <input
          className="w-full rounded border px-3 py-2 mt-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.airbnb.com/calendar/ical/..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">{es ? "Cuarto que bloquea" : "Room it blocks"}</label>
        <select
          className="w-full rounded border px-3 py-2 mt-1"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        >
          <option value="">{es ? "Elige un cuarto" : "Choose a room"}</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.hotel.name} - {l.title}
            </option>
          ))}
        </select>
      </div>
      <button disabled={loading} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
        {loading ? (es ? "Agregando…" : "Adding…") : es ? "Agregar calendario" : "Add calendar"}
      </button>
      {message && <div className={`text-sm ${message.includes("error") || message.includes("Failed") ? "text-red-600" : "text-green-600"}`}>{message}</div>}
    </form>
  );
}
