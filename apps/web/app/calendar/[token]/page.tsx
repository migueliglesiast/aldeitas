import { notFound } from "next/navigation";
import HotelMultiCalendar from "@/components/HotelMultiCalendar";
import { getHotelIdForShareToken } from "@/lib/hotel-calendar-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
          Calendario compartido
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
    </div>
  );
}
