"use client";

import { useState } from "react";
import { type AdminImage } from "@/lib/admin-image-upload";

type Props = {
  roomId: string;
  defaultAirbnbUrl?: string | null;
  hasExistingImages?: boolean;
  hasExistingDescription?: boolean;
  onImported: (result: { images?: AdminImage[]; description?: string }) => void;
};

export default function RoomAirbnbImport({
  roomId,
  defaultAirbnbUrl = "",
  hasExistingImages = false,
  hasExistingDescription = false,
  onImported,
}: Props) {
  const [airbnbUrl, setAirbnbUrl] = useState(defaultAirbnbUrl || "");
  const [importPhotos, setImportPhotos] = useState(true);
  const [importDescription, setImportDescription] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleImport() {
    const trimmed = airbnbUrl.trim();
    if (!trimmed) {
      setMessage("Enter an Airbnb listing URL first.");
      return;
    }

    if (!importPhotos && !importDescription) {
      setMessage("Select at least one item to import.");
      return;
    }

    if (
      importPhotos &&
      hasExistingImages &&
      !confirm("Importing photos will replace all current room photos. Continue?")
    ) {
      return;
    }

    if (
      importDescription &&
      hasExistingDescription &&
      !confirm("Importing will replace the current room description. Continue?")
    ) {
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/room/${roomId}/import-airbnb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airbnbUrl: trimmed,
          replaceExisting: true,
          importPhotos,
          importDescription,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to import from Airbnb");
      }

      onImported({
        images: data.images as AdminImage[] | undefined,
        description: data.description as string | undefined,
      });
      setAirbnbUrl(data.airbnbUrl || trimmed);

      const parts: string[] = [];
      if (data.photoCount > 0) {
        parts.push(`${data.photoCount} photo${data.photoCount === 1 ? "" : "s"}`);
      }
      if (data.description) {
        parts.push("description");
      }
      setMessage(
        parts.length > 0
          ? `Imported ${parts.join(" and ")} from Airbnb.`
          : "Import completed."
      );
      setTimeout(() => setMessage(null), 4000);
    } catch (error: any) {
      setMessage(error.message || "Failed to import from Airbnb");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-800">Import from Airbnb</h3>
        <p className="text-sm text-gray-500 mt-1">
          Paste the room&apos;s Airbnb listing link to pull photos and/or the listing
          description.
        </p>
      </div>

      <input
        type="url"
        value={airbnbUrl}
        onChange={(event) => setAirbnbUrl(event.target.value)}
        placeholder="https://www.airbnb.com/h/arbolita4"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
        disabled={importing}
      />

      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={importPhotos}
            onChange={(event) => setImportPhotos(event.target.checked)}
            disabled={importing}
            className="rounded border-gray-300 text-[#00a19c] focus:ring-[#00a19c]"
          />
          Photos
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={importDescription}
            onChange={(event) => setImportDescription(event.target.checked)}
            disabled={importing}
            className="rounded border-gray-300 text-[#00a19c] focus:ring-[#00a19c]"
          />
          Description
        </label>
      </div>

      <button
        type="button"
        onClick={handleImport}
        disabled={importing || !airbnbUrl.trim()}
        className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white hover:bg-[#008a86] disabled:opacity-50"
      >
        {importing ? "Importing..." : "Import from Airbnb"}
      </button>

      {message ? (
        <p
          className={`text-sm ${
            message.includes("Imported") ? "text-green-700" : "text-red-600"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
