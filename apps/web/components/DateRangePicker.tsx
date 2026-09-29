"use client";
import { useMemo, useState } from "react";

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

function weekdayLabels(locale: string) {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day.toLocaleDateString(locale, { weekday: "narrow" });
  });
}

type Props = {
  mode: "checkIn" | "checkOut";
  checkIn: string;
  checkOut: string;
  minDate: string;
  locale: string;
  onSelect: (value: string) => void;
};

export default function DateRangePicker({ mode, checkIn, checkOut, minDate, locale, onSelect }: Props) {
  const preferredKey = (mode === "checkOut" ? checkOut || checkIn : checkIn) || minDate;
  const anchor = parseKey(preferredKey < minDate ? minDate : preferredKey);
  const [cursor, setCursor] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));

  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const leading = (monthStart.getDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)),
  ];

  const canGoBack = dateKey(monthStart) > minDate.slice(0, 8) + "01";

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="absolute top-full left-0 z-50 mt-3 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line/60 bg-card p-4 shadow-pop"
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface disabled:opacity-30"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-sm font-semibold text-ink first-letter:uppercase">
          {monthStart.toLocaleDateString(locale, { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
        {weekdays.map((label, index) => (
          <div key={index}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-sm">
        {cells.map((day, index) => {
          if (!day) return <div key={index} />;
          const key = dateKey(day);
          const disabled = key < minDate;
          const isCheckIn = key === checkIn;
          const isCheckOut = key === checkOut;
          const inRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(key)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                isCheckIn || isCheckOut
                  ? "bg-brand font-semibold text-white"
                  : inRange
                    ? "bg-surface text-ink"
                    : "text-ink hover:bg-surface"
              } disabled:cursor-not-allowed disabled:text-muted/40 disabled:hover:bg-transparent`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
