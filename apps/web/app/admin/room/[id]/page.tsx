import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import RoomEditForm from "@/components/RoomEditForm";
import { getListingIcalExportUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function RoomEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(signInUrl(`/admin/room/${params.id}`));
  }

  // Get the room and verify user is a manager of its hotel
  const room = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      hotel: {
        include: {
          managers: {
            where: { userId: user.id },
          },
          listings: {
            select: { id: true, title: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      images: { orderBy: { position: "asc" } },
      calendarSources: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!room) {
    redirect("/admin");
  }

  // Verify user is a manager of this hotel
  if (room.hotel.managers.length === 0) {
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/hotel/${room.hotel.id}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Hotel
        </Link>
        <h1 className="text-3xl font-semibold">{room.title}</h1>
        <p className="text-gray-600">{room.hotel.name} - {room.hotel.location}</p>
      </div>

      <RoomEditForm
        room={room}
        icalExportUrl={getListingIcalExportUrl(room.id)}
        calendarSources={room.calendarSources.map((source) => ({
          id: source.id,
          name: source.name,
          icalUrl: source.icalUrl,
          createdAt: source.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}


