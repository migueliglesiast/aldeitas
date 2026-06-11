"use client";
import { useState } from "react";
import RoomImageUpload from "./RoomImageUpload";
import RoomAirbnbImport from "./RoomAirbnbImport";
import RoomIcalExport from "./RoomIcalExport";
import { type AdminImage } from "@/lib/admin-image-upload";

type Room = {
  id: string;
  title: string;
  airbnbUrl: string;
  description: string | null;
  guestsInBeds: number | null;
  guestsInBedsAndSofas: number | null;
  numberOfBeds: number | null;
  bedType: string | null;
  numberOfBathrooms: number | null;
  images: Array<{ id: string; url: string; position: number }>;
  hotel: {
    id: string;
    name: string;
    listings: Array<{ id: string; title: string }>;
  };
};

type Props = {
  room: Room;
  icalExportUrl: string;
};

export default function RoomEditForm({ room, icalExportUrl }: Props) {
  const [images, setImages] = useState<AdminImage[]>(room.images);
  const [formData, setFormData] = useState({
    description: room.description || "",
    guestsInBeds: room.guestsInBeds?.toString() || "",
    guestsInBedsAndSofas: room.guestsInBedsAndSofas?.toString() || "",
    numberOfBeds: room.numberOfBeds?.toString() || "",
    bedType: room.bedType || "",
    numberOfBathrooms: room.numberOfBathrooms?.toString() || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/room/${room.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description || null,
          guestsInBeds: formData.guestsInBeds ? parseInt(formData.guestsInBeds) : null,
          guestsInBedsAndSofas: formData.guestsInBedsAndSofas
            ? parseInt(formData.guestsInBedsAndSofas)
            : null,
          numberOfBeds: formData.numberOfBeds ? parseInt(formData.numberOfBeds) : null,
          bedType: formData.bedType || null,
          numberOfBathrooms: formData.numberOfBathrooms
            ? parseFloat(formData.numberOfBathrooms)
            : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update room");
      }

      setMessage("Room updated successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to update room");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Airbnb sync</h2>
        <RoomIcalExport exportUrl={icalExportUrl} />
        <RoomAirbnbImport
          roomId={room.id}
          defaultAirbnbUrl={room.airbnbUrl}
          hasExistingImages={images.length > 0}
          hasExistingDescription={Boolean(room.description?.trim())}
          onImported={({ images: importedImages, description }) => {
            if (importedImages) setImages(importedImages);
            if (description) {
              setFormData((current) => ({ ...current, description }));
            }
          }}
        />
      </div>

      {/* Room Details */}
      <form onSubmit={handleSave} className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Room Details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Description
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Write in English or Spanish. The site will automatically translate it for guests.
          </p>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
            placeholder="Describe this room in the language you prefer"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Guests in Beds
            </label>
            <input
              type="number"
              min="0"
              value={formData.guestsInBeds}
              onChange={(e) => setFormData({ ...formData, guestsInBeds: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
              placeholder="e.g., 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Guests in Beds and Sofas
            </label>
            <input
              type="number"
              min="0"
              value={formData.guestsInBedsAndSofas}
              onChange={(e) =>
                setFormData({ ...formData, guestsInBedsAndSofas: e.target.value })
              }
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
              placeholder="e.g., 4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Beds
            </label>
            <input
              type="number"
              min="0"
              value={formData.numberOfBeds}
              onChange={(e) => setFormData({ ...formData, numberOfBeds: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
              placeholder="e.g., 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bed Type</label>
            <input
              type="text"
              value={formData.bedType}
              onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
              placeholder="e.g., Queen, King, Twin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Bathrooms
            </label>
            <select
              value={formData.numberOfBathrooms}
              onChange={(e) => setFormData({ ...formData, numberOfBathrooms: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
            >
              <option value="">Select...</option>
              {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select 0.5 for half-bathrooms
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded ${
              message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[#00a19c] px-6 py-2 text-white hover:bg-[#008a86] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Room Details"}
        </button>
      </form>

      {/* Room Images */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Room Images</h2>
        <RoomImageUpload
          hotelId={room.hotel.id}
          hotelName={room.hotel.name}
          rooms={room.hotel.listings}
          roomId={room.id}
          initialImages={images}
        />
      </div>
    </div>
  );
}


