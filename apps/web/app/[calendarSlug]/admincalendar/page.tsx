import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import CalendarPinForm from "@/components/CalendarPinForm";
import HotelMultiCalendar from "@/components/HotelMultiCalendar";
import {
  calendarAccessCookieName,
  getHotelCalendarShareBySlug,
  hasCalendarAccess,
} from "@/lib/calendar-share";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function HotelAdminCalendarPage({
  params,
}: {
  params: Promise<{ calendarSlug: string }>;
}) {
  const { calendarSlug } = await params;
  const share = await getHotelCalendarShareBySlug(calendarSlug);
  if (!share) notFound();

  const hotel = await prisma.hotel.findUnique({
    where: { id: share.hotelId },
    select: { name: true, location: true },
  });
  if (!hotel) notFound();

  const cookieStore = await cookies();
  const unlocked = hasCalendarAccess(
    share,
    cookieStore.get(calendarAccessCookieName(share))?.value
  );

  if (!unlocked) {
    return <CalendarPinForm slug={share.slug as string} hotelName={hotel.name} />;
  }

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
      <HotelMultiCalendar hotelId={share.hotelId} readOnly shareSlug={share.slug as string} />
    </div>
  );
}
