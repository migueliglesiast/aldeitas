"use client";

import { useEffect, useMemo, useState } from "react";
import ImageWithPlaceholder from "@/components/ImageWithPlaceholder";
import {
  buildCopyDestinations,
  destinationKey,
  downloadAdminImages,
  type ImageCopyDestination,
} from "@/lib/admin-image-actions";
import {
  type AdminImage,
  partitionImageFiles,
  reorderImages,
  sortImagesByPosition,
} from "@/lib/admin-image-upload";

type Props = {
  hotelId: string;
  hotelName: string;
  rooms: Array<{ id: string; title: string }>;
  sourceType: "hotel" | "room";
  sourceId: string;
  initialImages: AdminImage[];
  altPrefix: string;
};

function isSuccessMessage(message: string) {
  return (
    message.includes("success") ||
    message.includes("uploaded") ||
    message.includes("saved") ||
    message.includes("copied") ||
    message.includes("downloaded") ||
    message.includes("deleted")
  );
}

export default function AdminImageGallery({
  hotelId,
  hotelName,
  rooms,
  sourceType,
  sourceId,
  initialImages,
  altPrefix,
}: Props) {
  const [images, setImages] = useState<AdminImage[]>(() => sortImagesByPosition(initialImages));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copyDestinationKey, setCopyDestinationKey] = useState("");

  const copyDestinations = useMemo(
    () => buildCopyDestinations(hotelId, hotelName, rooms, sourceType, sourceId),
    [hotelId, hotelName, rooms, sourceType, sourceId]
  );

  const uploadUrl =
    sourceType === "hotel"
      ? `/api/admin/hotel/${sourceId}/image`
      : `/api/admin/room/${sourceId}/image`;

  const reorderUrl =
    sourceType === "hotel"
      ? `/api/admin/hotel/${sourceId}/image/reorder`
      : `/api/admin/room/${sourceId}/image/reorder`;

  const deleteUrl = (imageId: string) =>
    sourceType === "hotel"
      ? `/api/admin/hotel/${sourceId}/image/${imageId}`
      : `/api/admin/room/${sourceId}/image/${imageId}`;

  useEffect(() => {
    setImages(sortImagesByPosition(initialImages));
  }, [initialImages]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => images.some((image) => image.id === id)));
  }, [images]);

  function clearSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
    setCopyDestinationKey("");
  }

  function toggleSelected(imageId: string) {
    setSelectedIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === images.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(images.map((image) => image.id));
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const { valid, errors } = partitionImageFiles(selectedFiles);
    if (valid.length === 0) {
      setMessage(errors.join(" "));
      event.target.value = "";
      return;
    }

    setUploading(true);
    setMessage(null);

    const uploaded: AdminImage[] = [];
    const uploadErrors: string[] = [...errors];

    try {
      for (let index = 0; index < valid.length; index++) {
        const file = valid[index];
        setUploadProgress(`Uploading ${index + 1} of ${valid.length}...`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append(sourceType === "hotel" ? "hotelId" : "roomId", sourceId);

        const response = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = `Failed to upload "${file.name}"`;
          try {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } catch {
            // ignore invalid JSON
          }
          uploadErrors.push(errorMessage);
          continue;
        }

        const data = await response.json();
        uploaded.push(data.image);
      }

      if (uploaded.length > 0) {
        setImages((current) => sortImagesByPosition([...current, ...uploaded]));
      }

      if (uploaded.length === valid.length && uploadErrors.length === 0) {
        setMessage(
          uploaded.length === 1
            ? "Image uploaded successfully!"
            : `${uploaded.length} images uploaded successfully!`
        );
      } else if (uploaded.length > 0) {
        setMessage(
          `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded. ${uploadErrors.join(" ")}`
        );
      } else {
        setMessage(uploadErrors.join(" ") || "Failed to upload images");
      }

      if (uploaded.length > 0) {
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to upload images");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      event.target.value = "";
    }
  }

  async function persistOrder(nextImages: AdminImage[]) {
    const previous = images;
    setImages(nextImages);
    setSavingOrder(true);

    try {
      const response = await fetch(reorderUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: nextImages.map((image) => image.id) }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to save photo order";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // ignore invalid JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const saved = sortImagesByPosition(data.images as AdminImage[]);
      setImages(saved);
      setMessage("Photo order saved.");
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setImages(previous);
      setMessage(error.message || "Failed to save photo order");
    } finally {
      setSavingOrder(false);
    }
  }

  function handleDragStart(imageId: string) {
    if (uploading || savingOrder || selectionMode || actionLoading) return;
    setDraggedId(imageId);
  }

  function handleDragOver(event: React.DragEvent, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId || uploading || savingOrder || selectionMode) {
      return;
    }

    setImages((current) => reorderImages(current, draggedId, targetId));
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    if (!draggedId || uploading || savingOrder || selectionMode) return;

    const nextImages = sortImagesByPosition(images);
    setDraggedId(null);
    await persistOrder(nextImages);
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected photo(s)?`)) return;

    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/hotel/${hotelId}/images/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceId,
          imageIds: selectedIds,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete selected photos";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // ignore invalid JSON
        }
        throw new Error(errorMessage);
      }

      setImages((current) =>
        sortImagesByPosition(current.filter((image) => !selectedIds.includes(image.id))).map(
          (image, index) => ({ ...image, position: index })
        )
      );
      setMessage(`${selectedIds.length} photo(s) deleted successfully!`);
      clearSelection();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to delete selected photos");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCopySelected() {
    if (selectedIds.length === 0 || !copyDestinationKey) return;

    const destination = copyDestinations.find(
      (item) => destinationKey(item) === copyDestinationKey
    );
    if (!destination) return;

    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/hotel/${hotelId}/images/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceId,
          imageIds: selectedIds,
          destinationType: destination.type,
          destinationId: destination.id,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to copy selected photos";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // ignore invalid JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setMessage(`${data.copiedCount} photo(s) copied to ${destination.label}.`);
      clearSelection();
      setTimeout(() => setMessage(null), 4000);
    } catch (error: any) {
      setMessage(error.message || "Failed to copy selected photos");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDownloadSelected() {
    if (selectedIds.length === 0) return;

    setActionLoading(true);
    setMessage(null);

    try {
      const selectedImages = images.filter((image) => selectedIds.includes(image.id));
      await downloadAdminImages(selectedImages);
      setMessage(`${selectedImages.length} photo(s) downloaded.`);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to download selected photos");
    } finally {
      setActionLoading(false);
    }
  }

  const busy = uploading || savingOrder || actionLoading;

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded p-3 ${
            isSuccessMessage(message) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!selectionMode ? (
          <button
            type="button"
            onClick={() => setSelectionMode(true)}
            disabled={busy || images.length === 0}
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Select
          </button>
        ) : (
          <>
            <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={busy || images.length === 0}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {selectedIds.length === images.length ? "Clear all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={busy || selectedIds.length === 0}
              className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
            <div className="flex items-center gap-2">
              <select
                value={copyDestinationKey}
                onChange={(event) => setCopyDestinationKey(event.target.value)}
                disabled={busy || selectedIds.length === 0 || copyDestinations.length === 0}
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Copy to...</option>
                {copyDestinations.map((destination) => (
                  <option key={destinationKey(destination)} value={destinationKey(destination)}>
                    {destination.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCopySelected}
                disabled={busy || selectedIds.length === 0 || !copyDestinationKey}
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={handleDownloadSelected}
              disabled={busy || selectedIds.length === 0}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Download
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={busy}
              className="rounded bg-[#00a19c] px-3 py-2 text-sm text-white hover:bg-[#008a86] disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {selectionMode
              ? "Select photos, then delete, copy, or download them."
              : "Drag photos to reorder. The first photo is used as the cover image."}
          </p>
          {savingOrder && <p className="text-sm text-gray-500">Saving photo order...</p>}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => {
              const isSelected = selectedIds.includes(image.id);
              const isDragging = draggedId === image.id;

              return (
                <div
                  key={image.id}
                  draggable={!busy && !selectionMode}
                  onDragStart={() => handleDragStart(image.id)}
                  onDragOver={(event) => handleDragOver(event, image.id)}
                  onDrop={handleDrop}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => {
                    if (selectionMode) toggleSelected(image.id);
                  }}
                  className={`group relative rounded-lg border bg-white ${
                    isSelected ? "ring-2 ring-[#00a19c]" : ""
                  } ${isDragging ? "opacity-50 ring-2 ring-[#00a19c]" : ""} ${
                    selectionMode ? "cursor-pointer" : busy ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
                    <ImageWithPlaceholder
                      src={image.url}
                      alt={`${altPrefix} ${index + 1}`}
                      fill
                      className="pointer-events-none object-cover"
                    />
                  </div>

                  <div className="flex items-center justify-between px-2 py-2 text-xs text-gray-600">
                    <span>{index === 0 ? "Cover" : `#${index + 1}`}</span>
                    <span className="text-gray-400">{selectionMode ? "Tap to select" : "Drag"}</span>
                  </div>

                  {selectionMode ? (
                    <div className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded border bg-white">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(image.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!confirm("Are you sure you want to delete this image?")) return;
                        fetch(deleteUrl(image.id), { method: "DELETE" })
                          .then((response) => {
                            if (!response.ok) throw new Error("Failed to delete image");
                            setImages((current) =>
                              sortImagesByPosition(
                                current.filter((item) => item.id !== image.id)
                              ).map((item, itemIndex) => ({ ...item, position: itemIndex }))
                            );
                            setMessage("Image deleted successfully!");
                            setTimeout(() => setMessage(null), 3000);
                          })
                          .catch((error: any) => {
                            setMessage(error.message || "Failed to delete image");
                          });
                      }}
                      disabled={busy}
                      className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:bg-gray-100">
        <div className="flex flex-col items-center justify-center pb-6 pt-5">
          <p className="mb-2 text-sm text-gray-500">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">PNG, JPG, GIF — up to 10MB each</p>
        </div>
        <input
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={busy}
        />
      </label>

      {uploading && (
        <div className="text-center text-gray-500">
          {uploadProgress || "Uploading images..."}
        </div>
      )}
    </div>
  );
}
