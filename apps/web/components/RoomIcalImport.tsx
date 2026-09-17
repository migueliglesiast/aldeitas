"use client";

import { useState } from "react";

type CalendarSource = {
  id: string;
  name: string;
  icalUrl: string;
  createdAt: string;
};

type Props = {
  roomId: string;
  roomTitle: string;
  initialSources: CalendarSource[];
};

export default function RoomIcalImport({
  roomId,
  roomTitle,
  initialSources,
}: Props) {
  const [sources, setSources] = useState(initialSources);
  const [icalUrl, setIcalUrl] = useState("");
  const [name, setName] = useState(`Airbnb - ${roomTitle}`);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/room/${roomId}/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icalUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add calendar");

      setSources((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setIcalUrl("");
      setMessage("Airbnb calendar linked.");
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add calendar");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(calendarId: string) {
    if (!confirm("Remove this Airbnb calendar from the room?")) return;

    setDeletingId(calendarId);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/room/${roomId}/calendar/${calendarId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove calendar");

      setSources((current) => current.filter((item) => item.id !== calendarId));
      setMessage("Calendar removed.");
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove calendar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-800">Import Airbnb bookings</h3>
        <p className="text-sm text-gray-500 mt-1">
          Paste Airbnb&apos;s export link here so this site blocks dates when Airbnb is
          booked. In Airbnb go to{" "}
          <span className="font-medium text-gray-700">
            Calendar → Availability settings → Connect calendars → Export calendar
          </span>
          .
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Airbnb iCal URL
          </label>
          <input
            type="url"
            value={icalUrl}
            onChange={(event) => setIcalUrl(event.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/....ics?s=..."
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white hover:bg-[#008a86] disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add Airbnb calendar"}
        </button>
      </form>

      {sources.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Linked calendars</p>
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded border border-gray-200 bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{source.name}</p>
                <p className="text-xs text-gray-500 break-all mt-1">{source.icalUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(source.id)}
                disabled={deletingId === source.id}
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 shrink-0"
              >
                {deletingId === source.id ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          No Airbnb calendar linked yet. Add one above so direct bookings respect Airbnb
          reservations.
        </p>
      )}

      {message ? (
        <div
          className={`text-sm rounded px-3 py-2 ${
            message.includes("Failed") || message.includes("Invalid")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
