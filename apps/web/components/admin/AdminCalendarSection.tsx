import PortfolioCalendar, { type PanelHotel, type PanelRoom } from "@/components/admin/PortfolioCalendar";
import { buildHotelCalendarData, type HotelCalendarPayload } from "@/lib/hotel-calendar-data";
import type { StaySource } from "@/lib/hotel-stats";
import { hotelTodayKey } from "@/lib/calendar-dates";

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

export default async function AdminCalendarSection({ hotelIds }: { hotelIds: string[] }) {
  const todayKey = hotelTodayKey();
  const payloads = (
    await Promise.all(
      hotelIds.map((id) => buildHotelCalendarData(id, { readOnly: true, months: 2 }).catch(() => null))
    )
  ).filter((p): p is HotelCalendarPayload => Boolean(p && p.rooms.length));
  if (payloads.length === 0) return null;

  const base = payloads[0];
  const startIndex = Math.max(base.days.indexOf(todayKey) - PAST_DAYS, 0);
  const days = base.days.slice(startIndex, startIndex + WINDOW_DAYS);
  const hotels: PanelHotel[] = payloads.map((p) => ({ id: p.hotel.id, name: p.hotel.name, rooms: toPanelRooms(p, days) }));
  return <PortfolioCalendar hotels={hotels} days={days} todayKey={todayKey} />;
}

export function AdminCalendarSkeleton() {
  return <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" aria-hidden />;
}
