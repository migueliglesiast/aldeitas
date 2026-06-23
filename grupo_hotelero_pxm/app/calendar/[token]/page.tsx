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
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-gray-500">Shared calendar</p>
        <h1 className="text-3xl font-semibold">{hotel.name}</h1>
        <p className="text-gray-600">{hotel.location}</p>
        <p className="mt-2 text-sm text-gray-500">Read-only view for the next 3 months.</p>
      </div>
      <HotelMultiCalendar hotelId={hotelId} readOnly shareToken={params.token} />
    </div>
  );
}
