"use client";
import { useEffect, useState, useMemo } from "react";
import { useHotel } from "@/lib/hotel-context";

type AvailabilityCalendarProps = {
  listingId: string;
  monthsToShow?: number;
};

export default function AvailabilityCalendar({
  listingId,
  monthsToShow = 6,
}: AvailabilityCalendarProps) {
  const { searchParams } = useHotel();
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get selected date range from context
  const selectedRange = useMemo(() => {
    if (!searchParams?.checkIn || !searchParams?.checkOut) {
      return null;
    }
    return {
      start: new Date(searchParams.checkIn + 'T00:00:00'),
      end: new Date(searchParams.checkOut + 'T00:00:00'),
    };
  }, [searchParams]);

  // Check if the selected range conflicts with booked dates
  // Note: We check dates from check-in up to (but not including) check-out,
  // since checkout day is when you leave (you don't stay that night)
  const isRangeUnavailable = useMemo(() => {
    if (!selectedRange) return false;
    
    const start = new Date(selectedRange.start);
    const end = new Date(selectedRange.end);
    const current = new Date(start);
    
    // Check all nights from check-in to check-out (exclusive of checkout day)
    while (current < end) {
      const dateKey = current.toISOString().split('T')[0];
      if (bookedDates.has(dateKey)) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return false;
  }, [selectedRange, bookedDates]);

  useEffect(() => {
    async function fetchAvailability() {
      try {
        setLoading(true);
        // Add ?debug=true to see debug information in console
        const response = await fetch(`/api/listings/${listingId}/availability?debug=true`);
        if (!response.ok) {
          throw new Error("Failed to fetch availability");
        }
        const data = await response.json();
        console.log("[AvailabilityCalendar] Fetched data:", data);
        if (data.debug) {
          console.log("[AvailabilityCalendar] Debug info:", data.debug);
        }
        setBookedDates(new Set(data.bookedDates || []));
        setError(null);
      } catch (err: any) {
        console.error("Error fetching availability:", err);
        setError(err.message || "Failed to load availability");
      } finally {
        setLoading(false);
      }
    }

    fetchAvailability();
  }, [listingId]);

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const isDateBooked = (date: Date): boolean => {
    return bookedDates.has(formatDateKey(date));
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isInSelectedRange = (date: Date): boolean => {
    if (!selectedRange) return false;
    const dateKey = formatDateKey(date);
    const startKey = formatDateKey(selectedRange.start);
    const endKey = formatDateKey(selectedRange.end);
    // Include both start and end dates in the range for visual clarity
    return dateKey >= startKey && dateKey <= endKey;
  };

  const isRangeStart = (date: Date): boolean => {
    if (!selectedRange) return false;
    return formatDateKey(date) === formatDateKey(selectedRange.start);
  };

  const isRangeEnd = (date: Date): boolean => {
    if (!selectedRange) return false;
    return formatDateKey(date) === formatDateKey(selectedRange.end);
  };

  const renderCalendar = () => {
    const months = [];
    const today = new Date();
    today.setDate(1); // Start from first day of current month

    for (let i = 0; i < monthsToShow; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      months.push(
        <div key={i} className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{monthName}</h3>
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}

            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const date = new Date(year, month, day);
              const dateKey = formatDateKey(date);
              const booked = isDateBooked(date);
              const today = isToday(date);
              const past = isPast(date);
              const inRange = isInSelectedRange(date);
              const rangeStart = isRangeStart(date);
              const rangeEnd = isRangeEnd(date);

              // Determine styling based on priority: booked > selected range > today > past > available
              let className = 'aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-colors';
              let title = 'Available';

              if (booked) {
                className += ' bg-gray-200 text-gray-400 line-through cursor-not-allowed';
                title = 'Booked';
              } else if (inRange) {
                // Highlight selected range - teal if available, orange if unavailable
                if (isRangeUnavailable) {
                  // Orange styling for unavailable range - subtle orange that matches page style
                  className += ' bg-orange-50 text-orange-600 border border-orange-200 font-semibold';
                  if (rangeStart && rangeEnd) {
                    className += ' rounded-lg';
                  } else if (rangeStart) {
                    className += ' rounded-l-lg';
                  } else if (rangeEnd) {
                    className += ' rounded-r-lg';
                  }
                  title = 'Selected (Unavailable)';
                } else {
                  // Teal styling for available range - matches title color
                  className += ' bg-[#00a19c]/20 text-[#00a19c] border border-[#00a19c]/30 font-semibold';
                  if (rangeStart && rangeEnd) {
                    className += ' rounded-lg';
                  } else if (rangeStart) {
                    className += ' rounded-l-lg';
                  } else if (rangeEnd) {
                    className += ' rounded-r-lg';
                  }
                  title = 'Selected';
                }
              } else if (today) {
                className += ' bg-[#00a19c]/10 text-[#00a19c] border-2 border-[#00a19c] font-semibold';
                title = 'Today';
              } else if (past) {
                className += ' text-gray-300 cursor-not-allowed';
                title = 'Past';
              } else {
                className += ' text-gray-700 hover:bg-gray-50 cursor-pointer hover:font-semibold';
                title = 'Available';
              }

              return (
                <div
                  key={day}
                  className={className}
                  title={title}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return months;
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="flex items-center justify-center">
          <svg
            className="animate-spin h-8 w-8 text-[#00a19c]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="text-center text-gray-500">
          <p>Unable to load availability calendar</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Availability</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-lg bg-gray-200 border border-gray-300"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-lg bg-[#00a19c]/10 border-2 border-[#00a19c]"></div>
            <span>Today</span>
          </div>
          {selectedRange && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-lg bg-[#00a19c]/20 border border-[#00a19c]/40"></div>
                <span>Selected</span>
              </div>
              {isRangeUnavailable && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-lg bg-orange-50 border border-orange-200"></div>
                  <span>Unavailable</span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-lg bg-white border border-gray-200"></div>
            <span>Available</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{renderCalendar()}</div>
    </div>
  );
}

