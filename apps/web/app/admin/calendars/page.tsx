import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import CalendarForm from "@/components/CalendarForm";
import CalendarSourceItem from "@/components/CalendarSourceItem";
import AdminText from "@/components/admin/AdminText";

export const dynamic = "force-dynamic";

export default async function CalendarsAdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(signInUrl("/admin/calendars"));
  }

  const [hotels, sources] = await Promise.all([
    prisma.hotel.findMany({
      where: { managers: { some: { userId: user.id } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, listings: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, icalUrl: true } } },
    }),
    prisma.calendarSource.findMany({
      where: { listing: { hotel: { managers: { some: { userId: user.id } } } } },
      include: { listing: { include: { hotel: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const synced = (listing: { id: string; icalUrl: string | null }) =>
    Boolean(listing.icalUrl) || sources.some((s) => s.listingId === listing.id);
  // Hotels with at least one connected room first: those are the ones being run day to day.
  const ordered = [...hotels].sort(
    (a, b) => Number(b.listings.some(synced)) - Number(a.listings.some(synced)) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">
          <AdminText es="Sincronización de calendarios" en="Calendar sync" />
        </h1>
        <p className="mt-1 max-w-3xl text-gray-600">
          <AdminText
            es="Conecta el calendario de Airbnb o Booking.com de cada cuarto. Así, cuando alguien reserva allá, esas noches se bloquean solas en Aldeitas y no hay reservas dobles."
            en="Connect each room's Airbnb or Booking.com calendar. When someone books there, those nights are blocked on Aldeitas automatically, so there are no double bookings."
          />
        </p>
      </div>

      <details className="group rounded-xl border bg-white">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-semibold text-aldeitas hover:bg-slate-50">
          + <AdminText es="Agregar un calendario" en="Add a calendar" />
        </summary>
        <div className="border-t p-4">
          <p className="mb-3 text-sm text-gray-600">
            <AdminText
              es="En Airbnb: Calendario → Disponibilidad → Conectar calendarios → Exportar calendario. Copia el enlace y pégalo aquí."
              en="On Airbnb: Calendar → Availability → Connect calendars → Export calendar. Copy the link and paste it here."
            />
          </p>
          <CalendarForm />
        </div>
      </details>

      <div className="space-y-6">
        {ordered.map((hotel) => {
          const done = hotel.listings.filter(synced).length;
          const mine = sources.filter((s) => s.listing?.hotel.id === hotel.id);
          const missing = hotel.listings.filter((l) => !synced(l));
          return (
            <section key={hotel.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold text-slate-900">{hotel.name}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    done === hotel.listings.length ? "bg-emerald-50 text-emerald-800" : done ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {done}/{hotel.listings.length} <AdminText es="cuartos conectados" en="rooms connected" />
                </span>
              </div>
              {mine.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {mine.map((s) => (
                    <CalendarSourceItem key={s.id} source={s} />
                  ))}
                </div>
              ) : null}
              {missing.length ? (
                <p className="text-sm text-gray-600">
                  <AdminText es="Sin calendario:" en="No calendar:" /> {missing.map((l) => l.title).join(", ")}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
