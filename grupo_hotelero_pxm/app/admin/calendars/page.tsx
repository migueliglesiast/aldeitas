import { prisma } from "@/lib/prisma";
import CalendarForm from "@/components/CalendarForm";
import CalendarSourceItem from "@/components/CalendarSourceItem";

export const dynamic = "force-dynamic";

export default async function CalendarsAdminPage() {
  const sources = await prisma.calendarSource.findMany({ 
    include: { 
      listing: {
        include: {
          hotel: {
            select: {
              name: true,
            },
          },
        },
      },
    }, 
    orderBy: { createdAt: "desc" } 
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendar Sources</h1>
        <p className="text-sm text-gray-600 mt-1">Add Guesty, Airbnb, or other iCal URLs for each room</p>
      </div>
      <CalendarForm />
      <div className="space-y-2">
        {sources.length === 0 ? (
          <div className="rounded border p-4 text-center text-gray-500">
            No calendar sources yet. Add one above to get started.
          </div>
        ) : (
          sources.map((s) => (
            <CalendarSourceItem key={s.id} source={s} />
          ))
        )}
      </div>
    </div>
  );
}


