import { notFound } from "next/navigation";
import HotelCalendarDashboardPage from "@/components/HotelCalendarDashboardPage";
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

  return <HotelCalendarDashboardPage hotelId={hotelId} token={token} hotel={hotel} owner={false} />;
}
