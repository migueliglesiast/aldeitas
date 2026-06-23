"use client";

import { useState } from "react";
import CoverImageWithFallback from "@/components/CoverImageWithFallback";
import { getHotelCoverCandidates } from "@/lib/hotel-cover";
import HotelContactsSection from "./HotelContactsSection";
import HotelImageUpload from "./HotelImageUpload";
import HotelMultiCalendar from "./HotelMultiCalendar";
import ImageWithPlaceholder from "./ImageWithPlaceholder";
import RoomList from "./RoomList";

type Hotel = {
  id: string;
  name: string;
  description: string;
  location: string;
  mainContactNumber: string | null;
  logoImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  contacts: Array<{
    id: string;
    type: string;
    name: string;
    phone: string;
  }>;
  images: Array<{ id: string; url: string; position: number }>;
  listings: Array<{
    id: string;
    title: string;
    description: string | null;
    images: Array<{ id: string; url: string; position: number }>;
  }>;
};

type TabId = "general" | "calendar" | "maintenance";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "general", label: "General Info" },
  { id: "calendar", label: "Multi Calendar" },
  { id: "maintenance", label: "Maintenance" },
];

export default function HotelAdminPanel({ hotel }: { hotel: Hotel }) {
  const [tab, setTab] = useState<TabId>("general");
  const [description, setDescription] = useState(hotel.description);
  const [mainContact, setMainContact] = useState(hotel.mainContactNumber || "");
  const [logoImageUrl, setLogoImageUrl] = useState(hotel.logoImageUrl || "");
  const [latitude, setLatitude] = useState(
    hotel.latitude != null ? String(hotel.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    hotel.longitude != null ? String(hotel.longitude) : ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const coverCandidates = getHotelCoverCandidates(hotel);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/hotel/${hotel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          mainContactNumber: mainContact || null,
          logoImageUrl: logoImageUrl || null,
          latitude: latitude.trim() ? Number(latitude) : null,
          longitude: longitude.trim() ? Number(longitude) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update hotel");
      }

      setMessage("Hotel updated successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Failed to update hotel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
              tab === item.id
                ? "border-[#00a19c] text-[#00a19c]"
                : "border-transparent text-gray-600 hover:text-gray-900",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <div className="space-y-8">
          <CoverImageWithFallback
            candidates={coverCandidates}
            alt={hotel.name}
            heightClassName="h-56 md:h-72"
            imageClassName="object-cover"
            className="rounded-lg border border-gray-200"
          />

          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-xl font-semibold">Hotel Information</h2>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Hotel Description
                </label>
                <span
                  className={`text-xs ${description.length > 500 ? "text-red-600" : "text-gray-500"}`}
                >
                  {description.length} / 500
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Write in English or Spanish. The site will automatically translate it for guests.
              </p>
              <textarea
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setDescription(e.target.value);
                  }
                }}
                rows={8}
                maxLength={500}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c] resize-y"
                placeholder="Describe your hotel in the language you prefer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Main Contact Number
              </label>
              <input
                type="tel"
                value={mainContact}
                onChange={(e) => setMainContact(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
                placeholder="Enter main contact number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Map Pin Location
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Set the exact latitude and longitude for this property. Copy values from Google
                Maps (right-click the pin → coordinates).
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
                    placeholder="15.842121"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
                    placeholder="-97.051367"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hotel Logo</label>
              <p className="text-sm text-gray-500 mb-3">
                Choose a logo from your hotel images. It appears when guests open the hotel and
                subtly influences the page palette.
              </p>

              {logoImageUrl ? (
                <div className="mb-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-white p-2 shadow-sm">
                    <ImageWithPlaceholder
                      src={logoImageUrl}
                      alt={`${hotel.name} logo preview`}
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">Current logo</p>
                    <p className="truncate text-xs text-gray-500">{logoImageUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoImageUrl("")}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p className="mb-4 text-sm text-gray-500">No logo selected yet.</p>
              )}

              {hotel.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {hotel.images.map((image) => {
                    const isSelected = logoImageUrl === image.url;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setLogoImageUrl(image.url)}
                        className={[
                          "relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                          isSelected
                            ? "border-[#00a19c] ring-2 ring-[#00a19c]/20"
                            : "border-gray-200 hover:border-[#00a19c]/40",
                        ].join(" ")}
                      >
                        <ImageWithPlaceholder
                          src={image.url}
                          alt={`Hotel image ${image.position + 1}`}
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                        {isSelected ? (
                          <span className="absolute left-2 top-2 rounded bg-[#00a19c] px-2 py-0.5 text-xs font-medium text-white">
                            Logo
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Upload hotel images below first, then choose one as the logo.
                </p>
              )}
            </div>

            {message ? (
              <div
                className={`p-3 rounded ${
                  message.includes("success")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-[#00a19c] px-6 py-2 text-white hover:bg-[#008a86] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Hotel Info"}
            </button>
          </div>

          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-xl font-semibold">Hotel Images</h2>
            <HotelImageUpload
              hotelId={hotel.id}
              hotelName={hotel.name}
              rooms={hotel.listings.map((listing) => ({ id: listing.id, title: listing.title }))}
              initialImages={hotel.images}
            />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Rooms</h2>
            <RoomList hotelId={hotel.id} rooms={hotel.listings} />
          </div>
        </div>
      ) : null}

      {tab === "calendar" ? <HotelMultiCalendar hotelId={hotel.id} /> : null}

      {tab === "maintenance" ? (
        <HotelContactsSection hotelId={hotel.id} initialContacts={hotel.contacts} />
      ) : null}
    </div>
  );
}
