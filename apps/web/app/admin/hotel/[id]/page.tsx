import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
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
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-semibold">{hotel.name}</h1>
        <p className="text-gray-600">{hotel.location}</p>
      </div>

      <HotelAdminPanel
        hotel={hotel}
        initialTab={tab === "calendar" || tab === "maintenance" ? tab : "general"}
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

