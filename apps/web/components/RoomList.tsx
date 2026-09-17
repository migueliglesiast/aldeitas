"use client";
import { useState } from "react";
import Link from "next/link";
import ImageWithPlaceholder from "@/components/ImageWithPlaceholder";

type Room = {
  id: string;
  title: string;
  description: string | null;
  images: Array<{ id: string; url: string; position: number }>;
};

type Props = {
  hotelId: string;
  rooms: Room[];
};

export default function RoomList({ hotelId, rooms }: Props) {
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <div
          key={room.id}
          className={`rounded-lg border border-gray-200 overflow-hidden bg-white transition-all duration-300 ${
            expandedRoomId === room.id ? "shadow-lg" : "hover:shadow-md"
          }`}
        >
          {expandedRoomId !== room.id ? (
            <button
              onClick={() => setExpandedRoomId(room.id)}
              className="w-full text-left"
            >
              <div className="relative h-48 w-full overflow-hidden">
                {room.images?.[0] ? (
                  <ImageWithPlaceholder
                    src={room.images[0].url}
                    alt={room.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                    No image
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg">{room.title}</h3>
                {room.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {room.description}
                  </p>
                )}
              </div>
            </button>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{room.title}</h3>
                <button
                  onClick={() => setExpandedRoomId(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <Link
                href={`/admin/room/${room.id}`}
                className="block w-full rounded bg-[#00a19c] px-4 py-2 text-center text-white hover:bg-[#008a86]"
              >
                Edit Room
              </Link>
            </div>
          )}
        </div>
      ))}
      {rooms.length === 0 && (
        <div className="col-span-full text-center text-gray-500 py-8">
          No rooms yet
        </div>
      )}
    </div>
  );
}


