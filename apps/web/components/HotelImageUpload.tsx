"use client";

import AdminImageGallery from "@/components/AdminImageGallery";
import { type AdminImage } from "@/lib/admin-image-upload";

type Props = {
  hotelId: string;
  hotelName: string;
  rooms: Array<{ id: string; title: string }>;
  initialImages: AdminImage[];
};

export default function HotelImageUpload({
  hotelId,
  hotelName,
  rooms,
  initialImages,
}: Props) {
  return (
    <AdminImageGallery
      hotelId={hotelId}
      hotelName={hotelName}
      rooms={rooms}
      sourceType="hotel"
      sourceId={hotelId}
      initialImages={initialImages}
      altPrefix="Hotel image"
    />
  );
}
