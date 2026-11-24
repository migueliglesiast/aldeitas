import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";
import AdminText from "@/components/admin/AdminText";

export const dynamic = "force-dynamic";

/** Shortcut from the admin to a hotel's owner calendar. */
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
    select: { hotel: { select: { id: true, name: true, location: true, _count: { select: { listings: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const target = hotels.find((h) => h.hotel.id === hotelId) ?? (hotels.length === 1 ? hotels[0] : null);
  if (target) {
    redirect(`/admin/hotel/${target.hotel.id}?tab=calendar`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">
          <AdminText es="Calendario" en="Calendar" />
        </h1>
        <p className="mt-1 text-gray-600">
          <AdminText es="Elige un hotel para ver sus reservas, bloqueos y limpiezas." en="Pick a hotel to see its bookings, blocks and cleanings." />
        </p>
      </div>
      {hotels.length === 0 ? (
        <p className="rounded-xl border bg-white p-6 text-center text-gray-500">
          <AdminText es="Todavía no tienes hoteles asignados." en="No hotels assigned to your account yet." />
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map(({ hotel }) => (
            <li key={hotel.id}>
              <Link
                href={`/admin/hotel/${hotel.id}?tab=calendar`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 hover:border-aldeitas/40 hover:shadow"
              >
                <span>
                  <span className="block font-semibold text-slate-900">{hotel.name}</span>
                  <span className="block text-sm text-gray-600">
                    {hotel.location} · {hotel._count.listings} <AdminText es={hotel._count.listings === 1 ? "cuarto" : "cuartos"} en={hotel._count.listings === 1 ? "room" : "rooms"} />
                  </span>
                </span>
                <span aria-hidden="true" className="text-xl text-aldeitas">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
