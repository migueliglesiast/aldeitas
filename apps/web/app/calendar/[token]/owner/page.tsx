import { notFound, redirect } from "next/navigation";
import HotelCalendarDashboardPage from "@/components/HotelCalendarDashboardPage";
import { getCurrentUser } from "@/lib/auth";
import { getHotelIdForShareToken } from "@/lib/hotel-calendar-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Owner dashboard: share token plus a signed-in manager of the hotel. */
export default async function OwnerHotelCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hotelId = await getHotelIdForShareToken(token);
  if (!hotelId) notFound();

  const user = await getCurrentUser();
  if (!user) {
    const ownerPath = `/calendar/${token}/owner`;
    redirect(`/sign-in?next=${encodeURIComponent(ownerPath)}`);
  }

  const manager = await prisma.hotelManager.findFirst({
    where: { userId: user.id, hotelId },
    select: { id: true },
  });
  if (!manager) notFound();

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { name: true, location: true },
  });
  if (!hotel) notFound();

  return <HotelCalendarDashboardPage hotelId={hotelId} token={token} hotel={hotel} owner />;
}
