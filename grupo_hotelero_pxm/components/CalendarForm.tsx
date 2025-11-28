"use client";
import { useState } from "react";

export default function CalendarForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icalUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      setMessage("Added");
      setName("");
      setUrl("");
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
        <label className="block text-sm">Name</label>
        <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm">Airbnb iCal URL</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.airbnb.com/calendar/ical/..."
          required
        />
      </div>
      <button disabled={loading} className="rounded bg-[#00a19c] px-4 py-2 text-white hover:bg-[#008a86] disabled:opacity-50">Add</button>
      {message && <div className="text-sm text-gray-600">{message}</div>}
    </form>
  );
}


