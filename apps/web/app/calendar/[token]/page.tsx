import { notFound } from "next/navigation";
import HotelMultiCalendar from "@/components/HotelMultiCalendar";
import { getHotelIdForShareToken } from "@/lib/hotel-calendar-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SharedHotelCalendarPage({
  params,
}: {
  params: { token: string };
}) {
  const hotelId = await getHotelIdForShareToken(params.token);
  if (!hotelId) notFound();

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { name: true, location: true },
  });

  if (!hotel) notFound();

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-2 py-4 sm:space-y-6 sm:px-4 sm:py-8">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 sm:text-sm">
          Shared calendar
        </p>
        <h1 className="text-xl font-semibold leading-tight sm:text-3xl">{hotel.name}</h1>
        <p className="text-sm text-gray-600 sm:text-base">{hotel.location}</p>
        <p className="mt-1 text-xs text-gray-500 sm:mt-2 sm:text-sm">
          Read-only · next 3 months · swipe sideways to see more dates
        </p>
      </div>
      <HotelMultiCalendar hotelId={hotelId} readOnly shareToken={params.token} />
    </div>
  );
}
