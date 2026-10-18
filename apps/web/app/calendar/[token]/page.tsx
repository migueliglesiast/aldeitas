import { Suspense } from "react";
import { notFound } from "next/navigation";
import HotelMultiCalendar from "@/components/HotelMultiCalendar";
import OwnerDashboard from "@/components/OwnerDashboard";
import { buildHotelCalendarData, getHotelIdForShareToken } from "@/lib/hotel-calendar-data";
import { computeHotelStats } from "@/lib/hotel-stats";
import { toDateKey } from "@/lib/calendar-dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const USD_TO_MXN = Number(process.env.OWNER_DASHBOARD_USD_MXN || 18.5);

async function HotelStatsSection({ hotelId }: { hotelId: string }) {
  const data = await buildHotelCalendarData(hotelId, {
    readOnly: true,
    pastDays: 30,
    months: 3,
  });
  if (!data || data.rooms.length === 0) return null;
  const stats = computeHotelStats(data, toDateKey(new Date()), USD_TO_MXN);
  return <OwnerDashboard stats={stats} />;
}

function StatsSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4" aria-hidden>
      <div className="h-6 w-32 rounded bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-black/[0.04] sm:h-28" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-black/[0.04]" />
    </div>
  );
}

export default async function SharedHotelCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hotelId = await getHotelIdForShareToken(token);
  if (!hotelId) notFound();

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { name: true, location: true },
  });

  if (!hotel) notFound();

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-2 py-4 sm:space-y-6 sm:px-4 sm:py-8">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400 sm:text-xs">
          Panel del propietario
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          {hotel.name}
        </h1>
        <p className="text-sm text-gray-500 sm:text-base">{hotel.location}</p>
        <p className="mt-1 text-xs text-gray-400 sm:mt-2 sm:text-sm">
          Solo lectura · próximos 3 meses · desliza para ver más fechas
        </p>
      </div>
      <HotelMultiCalendar hotelId={hotelId} readOnly shareToken={token} />
      <Suspense fallback={<StatsSkeleton />}>
        <HotelStatsSection hotelId={hotelId} />
      </Suspense>
    </div>
  );
}
