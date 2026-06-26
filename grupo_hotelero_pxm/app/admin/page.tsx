import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getHotelCoverCandidates } from "@/lib/hotel-cover";
import CoverImageWithFallback from "@/components/CoverImageWithFallback";
import NicknameEditor from "@/components/NicknameEditor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(signInUrl("/admin"));
  }

  // Get hotels managed by this user
  const hotelManagers = await prisma.hotelManager.findMany({
    where: { userId: user.id },
    include: {
      hotel: {
        include: {
          listings: {
            include: { images: { orderBy: { position: "asc" } } },
            orderBy: { createdAt: "asc" },
          },
          images: { orderBy: { position: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const hotels = hotelManagers.map((hm) => hm.hotel);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">
            Welcome {user.nickname || user.username || "Manager"}
          </h1>
          <p className="text-gray-600">Manage your hotels and rooms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/bookings"
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            View bookings
          </Link>
          <Link
            href="/admin/calendars"
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Manage calendars
          </Link>
        </div>
      </div>

      {/* Inline Nickname Editor - Only show if nickname doesn't exist */}
      {!user.nickname && (
        <NicknameEditor />
      )}

      {/* Personal Information Section */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-gray-900">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <p className="text-gray-900">{user.fullName || "Not set"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <p className="text-gray-900">{user.phoneNumber || "Not set"}</p>
          </div>
        </div>
        <Link
          href="/admin/profile"
          className="inline-block mt-4 rounded bg-[#00a19c] px-4 py-2 text-white hover:bg-[#008a86]"
        >
          Edit Profile
        </Link>
      </div>

      {/* Hotels Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Your Hotels</h2>
        {hotels.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-gray-500">
            No hotels assigned to your account yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => {
              const coverCandidates = getHotelCoverCandidates(hotel);

              return (
              <Link
                key={hotel.id}
                href={`/admin/hotel/${hotel.id}`}
                className="group rounded-lg border border-gray-200 hover:border-[#00a19c]/30 hover:shadow-lg transition-all duration-300 bg-white overflow-hidden"
              >
                <CoverImageWithFallback
                  candidates={coverCandidates}
                  alt={hotel.name}
                  heightClassName="h-48"
                  imageClassName="object-cover transition-transform group-hover:scale-105"
                />
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{hotel.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{hotel.location}</p>
                  <p className="text-sm text-gray-500">
                    {hotel.listings.length} room{hotel.listings.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

