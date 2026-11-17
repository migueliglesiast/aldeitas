import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInUrl } from "@/lib/auth-redirect";
import { loadHotelPerformance, loadMarket } from "@/lib/booking-performance-data";
import BookingPerformance, { MarketPanel, MarketSkeleton } from "@/components/performance/BookingPerformance";

export const dynamic = "force-dynamic";

async function Market({ hotelId }: { hotelId: string }) {
  const data = await loadMarket(hotelId);
  return <MarketPanel data={data} />;
}

export default async function HotelPerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInUrl(`/admin/hotel/${id}/performance`));
  const manager = await prisma.hotelManager.findFirst({ where: { userId: user.id, hotelId: id }, select: { id: true } });
  if (!manager) redirect("/admin");

  const { hotel, report, recs } = await loadHotelPerformance(id);
  return (
    <BookingPerformance hotel={hotel} report={report} recs={recs}>
      <Suspense fallback={<MarketSkeleton />}>
        <Market hotelId={id} />
      </Suspense>
    </BookingPerformance>
  );
}
