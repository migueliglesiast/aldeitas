"use client";
import { useState } from "react";

type Props = {
  listingId: string;
  basePriceCents: number;
  currency: string;
};

export default function BookingForm({ listingId, basePriceCents, currency }: Props) {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const nights = start && end ? Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const total = Math.round(nights * basePriceCents);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, start, end, email, phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking failed");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
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
    <form onSubmit={submit} className="space-y-3 rounded border p-4">
      <div className="space-y-1">
        <label className="block text-sm">Check-in</label>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded border px-3 py-2" required />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">Check-out</label>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded border px-3 py-2" required />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border px-3 py-2" required />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">Phone</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border px-3 py-2" required />
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{nights} nights</span>
        <span>
          Total: {(total / 100).toFixed(2)} {currency}
        </span>
      </div>
      <button disabled={loading} className="w-full rounded bg-[#00a19c] py-2 text-white hover:bg-[#008a86] disabled:opacity-50">
        {loading ? "Processing..." : "Reserve"}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}


