import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminText from "@/components/admin/AdminText";
import HotelAdminPanel from "@/components/HotelAdminPanel";
import HotelCalendarDashboardPage from "@/components/HotelCalendarDashboardPage";
import { getOrCreateHotelCalendarShareToken } from "@/lib/hotel-calendar-data";
import ReviewsPanel from "@/components/ReviewsPanel";
import AddonsPanel from "@/components/AddonsPanel";
import { getHotelReviewInsights } from "@/lib/review-insights";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function HotelReviews({ hotelId }: { hotelId: string }) {
  const insights = await getHotelReviewInsights(hotelId);
  if (!insights) return null;
  return <ReviewsPanel insights={insights} staff={false} />;
}

export default async function HotelEditPage({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await paramsPromise;
  const { tab } = await searchParams;
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
  const share = await getOrCreateHotelCalendarShareToken(hotel.id);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-heading">{hotel.name}</h1>
            <p className="text-gray-600">{hotel.location}</p>
          </div>
          <Link
            href={`/admin/hotel/${hotel.id}/performance`}
            className="rounded-lg bg-heading px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
          >
            <AdminText es="Ver rendimiento" en="View performance" />
          </Link>
        </div>
      </div>

      <HotelAdminPanel
        hotel={hotel}
        initialTab={tab === "general" || tab === "maintenance" ? tab : "calendar"}
        dashboard={
          <HotelCalendarDashboardPage
            hotelId={hotel.id}
            token={share.token}
            hotel={{ name: hotel.name, location: hotel.location }}
            owner
            editable
          />
        }
      />

      <AddonsPanel hotelId={hotel.id} />

      <Suspense fallback={null}>
        <HotelReviews hotelId={hotel.id} />
      </Suspense>
    </div>
  );
}

