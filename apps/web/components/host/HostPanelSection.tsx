import HostPanel, { type PanelHotel, type PanelRoom } from "@/components/host/HostPanel";
import { buildHotelCalendarData, type HotelCalendarPayload } from "@/lib/hotel-calendar-data";
import { computeHotelStats, type StaySource } from "@/lib/hotel-stats";
import { hotelTodayKey } from "@/lib/calendar-dates";
import { buildHostInsights } from "@/lib/host-insights";
import { getOnboardingState } from "@/lib/onboarding";

const USD_TO_MXN = Number(process.env.OWNER_DASHBOARD_USD_MXN || 18.5);
const PAST_DAYS = 1;
const WINDOW_DAYS = 21;

function spanSource(kind: string, source?: StaySource): StaySource {
  if (source) return source;
  if (kind === "manual_block") return "blocked";
  if (kind === "ghost") return "ghost";
  if (kind === "booking") return "aldeitas";
  return "airbnb";
}

/** Window rows for the cross-hotel calendar: only what the panel draws. */
export function toPanelRooms(payload: HotelCalendarPayload, days: string[]): PanelRoom[] {
  const first = days[0];
  const last = days[days.length - 1];
  const index = new Map(days.map((d, i) => [d, i]));
  return payload.rooms.map((room) => ({
    id: room.id,
    title: room.title,
    hotelId: payload.hotel.id,
    prices: days.map((d) => {
      const cell = room.cells[d];
      return cell && cell.status === "available" && cell.priceCents > 0 ? cell.priceCents : null;
    }),
    spans: room.spans
      .filter((s) => s.endDay >= first && s.startDay <= last)
      .map((s) => {
        const startKey = s.startDay < first ? first : s.startDay;
        const endKey = s.endDay > last ? last : s.endDay;
        return {
          id: s.id,
          start: index.get(startKey) ?? 0,
          end: index.get(endKey) ?? days.length - 1,
          kind: s.kind,
          source: spanSource(s.kind, s.source),
          label: s.guestName || s.label,
          guestCount: s.guestCount ?? null,
          bookingId: s.bookingId ?? null,
          startsBefore: (s.rangeStartDay || s.startDay) < first,
          endsAfter: s.endDay > last,
        };
      }),
  }));
}

export default async function HostPanelSection({ userId, hotelIds }: { userId: string; hotelIds: string[] }) {
  const todayKey = hotelTodayKey();
  const payloads = (
    await Promise.all(
      hotelIds.map((id) =>
        buildHotelCalendarData(id, { readOnly: true, pastDays: 30, months: 3 }).catch(
          () => null
        )
      )
    )
  ).filter((p): p is HotelCalendarPayload => Boolean(p && p.rooms.length));

  const missingCount = await getOnboardingState(userId)
    .then((s) => s.missing.length)
    .catch(() => 0);

  if (payloads.length === 0) {
    return <HostPanel hotels={[]} days={[]} stats={null} insights={[]} />;
  }

  const base = payloads[0];
  const startIndex = Math.max(base.days.indexOf(todayKey) - PAST_DAYS, 0);
  const days = base.days.slice(startIndex, startIndex + WINDOW_DAYS);
  const multi = payloads.length > 1;
  const merged: HotelCalendarPayload = {
    ...base,
    rooms: payloads.flatMap((p) =>
      p.rooms.map((r) => ({ ...r, title: multi ? `${p.hotel.name} · ${r.title}` : r.title }))
    ),
  };
  const stats = computeHotelStats(merged, todayKey, USD_TO_MXN);
  const hotels: PanelHotel[] = payloads.map((p) => ({
    id: p.hotel.id,
    name: p.hotel.name,
    rooms: toPanelRooms(p, days),
  }));

  return <HostPanel hotels={hotels} days={days} stats={stats} insights={buildHostInsights(stats, missingCount)} />;
}

export function HostPanelSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden>
      <div className="h-80 animate-pulse rounded-xl bg-black/[0.04]" />
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-black/[0.04]" />
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-xl bg-black/[0.04]" />
      </div>
    </div>
  );
}
