"use client";
import { useState } from "react";
import Link from "next/link";

type UnitInput = {
  name_of_unit: string;
  num_of_guests: number;
  description: string;
  private_ammenities?: string;
  number_of_beds: number;
  number_of_bathrooms: number;
  cost_night: number;
  calendar?: string;
};

export default function SignUpPage() {
  const [form, setForm] = useState({
    username: "",
    hotel_name: "",
    email: "",
    password: "",
    phone_number: "",
    instagram_link: "",
    short_description: "",
    public_ammenities: "",
  });
  const [units, setUnits] = useState<UnitInput[]>([]);
  const [numRooms, setNumRooms] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function initializeUnits(count: number) {
    const arr: UnitInput[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({ name_of_unit: "", num_of_guests: 1, description: "", number_of_beds: 1, number_of_bathrooms: 1, cost_night: 100 });
    }
    setUnits(arr);
  }

  function updateUnit(index: number, patch: Partial<UnitInput>) {
    setUnits((arr) => arr.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  function removeUnit(index: number) {
    setUnits((arr) => arr.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, units }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json();
      setError(data.error || "Failed to sign up");
    }
    setLoading(false);
  }

  const slides = [
    {
      key: "welcome",
      render: (
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Welcome to the Aldeita Family!</h1>
          <p className="text-gray-600">Lets start by creating your account.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="rounded border px-3 py-2" placeholder="Username" value={form.username} onChange={(e) => update("username", e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Name of hotel" value={form.hotel_name} onChange={(e) => update("hotel_name", e.target.value)} />
          </div>
        </div>
      ),
    },
    {
      key: "rooms",
      render: (
        <div className="space-y-3">
          <h2 className="text-xl font-medium">How many rooms?</h2>
          <input className="w-40 rounded border px-3 py-2" type="number" min={0} value={numRooms ?? 0} onChange={(e) => setNumRooms(Number(e.target.value))} />
          <button type="button" className="rounded border px-3 py-2 hover:bg-gray-50" onClick={() => initializeUnits(Math.max(0, numRooms || 0))}>Set rooms</button>
          {units.length > 0 && <div className="text-sm text-gray-600">You will describe {units.length} room(s) next.</div>}
        </div>
      ),
    },
    ...units.map((u, i) => ({
      key: `unit-${i}`,
      render: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Describe room {i + 1} of {units.length}</h2>
            <div className="text-sm text-gray-500">Use the arrows below to navigate</div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="rounded border px-3 py-2" placeholder="Name of unit" value={u.name_of_unit} onChange={(e) => updateUnit(i, { name_of_unit: e.target.value })} />
            <input className="rounded border px-3 py-2" placeholder="Guests" type="number" min={1} value={u.num_of_guests} onChange={(e) => updateUnit(i, { num_of_guests: Number(e.target.value) })} />
            <input className="rounded border px-3 py-2" placeholder="Beds" type="number" min={0} value={u.number_of_beds} onChange={(e) => updateUnit(i, { number_of_beds: Number(e.target.value) })} />
            <input className="rounded border px-3 py-2" placeholder="Bathrooms" type="number" min={0} step="0.5" value={u.number_of_bathrooms} onChange={(e) => updateUnit(i, { number_of_bathrooms: Number(e.target.value) })} />
            <input className="rounded border px-3 py-2" placeholder="Cost per night (USD)" type="number" min={0} step="0.01" value={u.cost_night} onChange={(e) => updateUnit(i, { cost_night: Number(e.target.value) })} />
            <input className="rounded border px-3 py-2" placeholder="Calendar iCal URL (optional)" value={u.calendar ?? ""} onChange={(e) => updateUnit(i, { calendar: e.target.value })} />
            <input className="sm:col-span-2 rounded border px-3 py-2" placeholder="Private amenities (comma separated)" value={u.private_ammenities ?? ""} onChange={(e) => updateUnit(i, { private_ammenities: e.target.value })} />
            <textarea className="sm:col-span-2 rounded border px-3 py-2" placeholder="Unit description" value={u.description} onChange={(e) => updateUnit(i, { description: e.target.value })} />
          </div>
        </div>
      ),
    })),
    {
      key: "details",
      render: (
        <div className="space-y-3">
          <h2 className="text-xl font-medium">Tell us more about you</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="rounded border px-3 py-2" placeholder="Phone number" value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Instagram link (https://...)" value={form.instagram_link} onChange={(e) => update("instagram_link", e.target.value)} />
            <input className="sm:col-span-2 rounded border px-3 py-2" placeholder="Public amenities" value={form.public_ammenities} onChange={(e) => update("public_ammenities", e.target.value)} />
            <textarea className="sm:col-span-2 rounded border px-3 py-2" placeholder="Short description" value={form.short_description} onChange={(e) => update("short_description", e.target.value)} />
          </div>
        </div>
      ),
    },
    {
      key: "finish",
      render: (
        <div className="space-y-3">
          <h2 className="text-xl font-medium">Youre all set!</h2>
          <p className="text-gray-600">Click Finish to create your account and publish your hotel.</p>
          <button disabled={loading} onClick={onSubmit as any} className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-60">{loading ? "Submitting..." : "Finish"}</button>
        </div>
      ),
    },
  ];

  function next() { setStep((s) => Math.min(slides.length - 1, s + 1)); }
  function prev() { setStep((s) => Math.max(0, s - 1)); }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative overflow-hidden rounded border p-5">
        {slides[step]?.render}
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={prev} className="rounded border px-3 py-2 hover:bg-gray-50">Back</button>
          <div className="text-sm text-gray-500">Step {step + 1} of {slides.length}</div>
          <button type="button" onClick={next} className="rounded border px-3 py-2 hover:bg-gray-50">Next</button>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Already have an account? <Link className="text-black underline" href="/sign-in">Sign in</Link>
      </p>
    </div>
  );
}


