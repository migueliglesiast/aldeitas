import { addDays, addMonths, eachDayOfInterval, format, parseISO } from "date-fns";

export const HOTEL_CALENDAR_MONTHS = 3;

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(dateKey: string) {
  return parseISO(`${dateKey}T00:00:00`);
}

export function getHotelCalendarWindow(months = HOTEL_CALENDAR_MONTHS) {
  const start = parseDateKey(toDateKey(new Date()));
  const end = addDays(addMonths(start, months), -1);
  return { start, end };
}

export function listDateKeys(start: Date, end: Date) {
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
) {
  return aStart < bEnd && bStart < aEnd;
}

export function dateKeysForRange(start: Date, end: Date) {
  const keys: string[] = [];
  const current = new Date(start);
  while (current < end) {
    keys.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
}
