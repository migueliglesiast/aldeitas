import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { getOrCreateHotelCalendarShareToken } from "@/lib/hotel-calendar-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Shortcut from the admin to a hotel's owner calendar (/calendar/[token]/owner). */
export default async function AdminCalendarShortcut({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(signInUrl("/admin/calendar"));

  const { hotel: hotelId } = await searchParams;
  const hotels = await prisma.hotelManager.findMany({
    where: { userId: user.id },
    select: { hotel: { select: { id: true, name: true, location: true } } },
    orderBy: { createdAt: "asc" },
  });

  const target = hotels.find((h) => h.hotel.id === hotelId) ?? (hotels.length === 1 ? hotels[0] : null);
  if (target) {
    const share = await getOrCreateHotelCalendarShareToken(target.hotel.id);
    redirect(`/calendar/${share.token}/owner`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Calendar</h1>
      {hotels.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-gray-500">No hotels assigned to your account yet.</p>
      ) : (
        <ul className="space-y-2">
          {hotels.map(({ hotel }) => (
            <li key={hotel.id}>
              <Link
                href={`/admin/calendar?hotel=${hotel.id}`}
                className="block rounded-lg border bg-white p-4 hover:border-[#00a19c]/40 hover:shadow"
              >
                <span className="font-semibold">{hotel.name}</span>
                <span className="block text-sm text-gray-500">{hotel.location}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
