import { Suspense } from "react";
import HotelMultiCalendar from "@/components/HotelMultiCalendar";
import OwnerDashboard from "@/components/OwnerDashboard";
import { buildHotelCalendarData } from "@/lib/hotel-calendar-data";
import { computeHotelStats, toPublicStats } from "@/lib/hotel-stats";
import { hotelTodayKey } from "@/lib/calendar-dates";

const USD_TO_MXN = Number(process.env.OWNER_DASHBOARD_USD_MXN || 18.5);

async function HotelStatsSection({ hotelId, owner }: { hotelId: string; owner: boolean }) {
  const data = await buildHotelCalendarData(hotelId, {
    readOnly: true,
    pastDays: 30,
    months: 3,
  });
  if (!data || data.rooms.length === 0) return null;
  const stats = computeHotelStats(data, hotelTodayKey(), USD_TO_MXN);
  return <OwnerDashboard stats={owner ? stats : toPublicStats(stats)} showMoney={owner} />;
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

/** Shared calendar + stats. `owner` adds prices and every money figure. */
export default function HotelCalendarDashboardPage({
  hotelId,
  token,
  hotel,
  owner,
}: {
  hotelId: string;
  token: string;
  hotel: { name: string; location: string };
  owner: boolean;
}) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-2 py-4 sm:space-y-6 sm:px-4 sm:py-8">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400 sm:text-xs">
          {owner ? "Panel del propietario" : "Calendario compartido"}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          {hotel.name}
        </h1>
        <p className="text-sm text-gray-500 sm:text-base">{hotel.location}</p>
        <p className="mt-1 text-xs text-gray-400 sm:mt-2 sm:text-sm">
          Solo lectura · próximos 3 meses · desliza para ver más fechas
        </p>
      </div>
      <HotelMultiCalendar hotelId={hotelId} readOnly shareToken={token} showPrices={owner} />
      <Suspense fallback={<StatsSkeleton />}>
        <HotelStatsSection hotelId={hotelId} owner={owner} />
      </Suspense>
    </div>
  );
}
