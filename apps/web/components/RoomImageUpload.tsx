"use client";

import AdminImageGallery from "@/components/AdminImageGallery";
import { type AdminImage } from "@/lib/admin-image-upload";

type Props = {
  hotelId: string;
  hotelName: string;
  rooms: Array<{ id: string; title: string }>;
  roomId: string;
  initialImages: AdminImage[];
};

export default function RoomImageUpload({
  hotelId,
  hotelName,
  rooms,
  roomId,
  initialImages,
}: Props) {
  return (
    <AdminImageGallery
      hotelId={hotelId}
      hotelName={hotelName}
      rooms={rooms}
      sourceType="room"
      sourceId={roomId}
      initialImages={initialImages}
      altPrefix="Room image"
    />
  );
}
