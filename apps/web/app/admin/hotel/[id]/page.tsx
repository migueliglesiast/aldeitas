import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import HotelAdminPanel from "@/components/HotelAdminPanel";

export const dynamic = "force-dynamic";

export default async function HotelEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(signInUrl(`/admin/hotel/${params.id}`));
  }

  // Verify user is a manager of this hotel
  const hotelManager = await prisma.hotelManager.findFirst({
    where: {
      userId: user.id,
      hotelId: params.id,
    },
    include: {
      hotel: {
        include: {
          listings: {
            include: { images: { orderBy: { position: "asc" } } },
            orderBy: { createdAt: "asc" },
          },
          contacts: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
          images: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!hotelManager) {
    redirect("/admin");
  }

  const hotel = hotelManager.hotel;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-semibold">{hotel.name}</h1>
        <p className="text-gray-600">{hotel.location}</p>
      </div>

      <HotelAdminPanel hotel={hotel} />
    </div>
  );
}

