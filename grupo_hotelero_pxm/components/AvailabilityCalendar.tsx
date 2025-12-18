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
  const { searchParams, setSearchParams } = useHotel();
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local calendar selection state (before updating context)
  const [calendarCheckIn, setCalendarCheckIn] = useState<string | null>(null);
  const [calendarCheckOut, setCalendarCheckOut] = useState<string | null>(null);

  // Sync calendar selection with context, but prioritize local calendar state if user is actively selecting
  // Treat empty strings as null to ensure proper clearing
  // If local state is explicitly null, use that (don't fall back to context) - this ensures clearing works immediately
  const effectiveCheckIn = calendarCheckIn !== null ? calendarCheckIn : (searchParams?.checkIn && searchParams.checkIn.trim() !== "" ? searchParams.checkIn : null);
  const effectiveCheckOut = calendarCheckOut !== null ? calendarCheckOut : (searchParams?.checkOut && searchParams.checkOut.trim() !== "" ? searchParams.checkOut : null);

  // Get selected date range from effective dates
  // Only create range if BOTH check-in and check-out are valid (not empty strings or null)
  const selectedRange = useMemo(() => {
    const checkIn = effectiveCheckIn && effectiveCheckIn.trim() !== "" ? effectiveCheckIn : null;
    const checkOut = effectiveCheckOut && effectiveCheckOut.trim() !== "" ? effectiveCheckOut : null;
    
    if (!checkIn || !checkOut) {
      return null;
    }
    return {
      start: new Date(checkIn + 'T00:00:00'),
      end: new Date(checkOut + 'T00:00:00'),
    };
  }, [effectiveCheckIn, effectiveCheckOut]);

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

  // Sync calendar selection with context when context changes externally (e.g., from form)
  // But don't override if user is actively selecting (local state takes precedence)
  useEffect(() => {
    // Only sync if the context values differ from local state (external changes)
    const contextCheckIn = searchParams?.checkIn && searchParams.checkIn.trim() !== "" ? searchParams.checkIn : null;
    const contextCheckOut = searchParams?.checkOut && searchParams.checkOut.trim() !== "" ? searchParams.checkOut : null;
    
    // If context has check-in and it's different from local state, sync it
    if (contextCheckIn && contextCheckIn !== calendarCheckIn) {
      setCalendarCheckIn(contextCheckIn);
    }
    
    // If context check-out is empty/null, always clear local check-out (don't restore old values)
    if (!contextCheckOut) {
      if (calendarCheckOut !== null) {
        setCalendarCheckOut(null);
      }
    } else {
      // Only sync check-out if context has a value AND it's different from local state
      if (contextCheckOut !== calendarCheckOut) {
        setCalendarCheckOut(contextCheckOut);
      }
    }
    
    // If context is completely cleared, clear local state
    if (!searchParams) {
      setCalendarCheckIn(null);
      setCalendarCheckOut(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.checkIn, searchParams?.checkOut]);

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

  // Check if a date is clickable based on current selection state
  const isDateClickable = (date: Date): boolean => {
    const dateKey = formatDateKey(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Can't click past dates
    if (checkDate < today) return false;
    
    // Can't click booked dates
    if (bookedDates.has(dateKey)) return false;
    
    // If BOTH check-in and check-out are selected (complete range), all dates become selectable again
    // This allows user to select a new check-in from anywhere
    if (effectiveCheckIn && effectiveCheckOut) {
      return true; // All dates are clickable when range is complete
    }
    
    // If only check-in is selected (no check-out yet), disable dates before check-in
    if (effectiveCheckIn && !effectiveCheckOut) {
      const checkInDate = new Date(effectiveCheckIn + 'T00:00:00');
      checkInDate.setHours(0, 0, 0, 0);
      
      if (checkDate < checkInDate) return false;
      
      // Also disable dates after the first unavailable date following check-in
      let current = new Date(checkInDate);
      current.setDate(current.getDate() + 1);
      
      // Find the first unavailable date after check-in
      while (current <= checkDate) {
        const currentKey = formatDateKey(current);
        if (bookedDates.has(currentKey)) {
          // Found an unavailable date, disable everything from that point forward
          return false;
        }
        current.setDate(current.getDate() + 1);
      }
    }
    
    return true;
  };

  // Handle date click - Airbnb-style: first click = check-in, second click = check-out
  const handleDateClick = (date: Date) => {
    if (!isDateClickable(date)) return;
    
    const dateKey = formatDateKey(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate < today) return;
    if (bookedDates.has(dateKey)) return;
    
    // If clicking the same date as check-in (and no check-out), clear selection
    if (effectiveCheckIn === dateKey && !effectiveCheckOut) {
      setCalendarCheckIn(null);
      setCalendarCheckOut(null);
      setSearchParams(null);
      return;
    }
    
    // If a complete range is selected (both check-in and check-out), clicking any date starts a new selection
    // OR if no check-in is selected, set as check-in
    // OR if clicking before/on current check-in, reset and set new check-in
    if ((effectiveCheckIn && effectiveCheckOut) || !effectiveCheckIn || dateKey <= effectiveCheckIn) {
      // Reset previous selection completely - clear check-out FIRST to immediately remove range highlights
      // Set both to null explicitly to ensure effectiveCheckOut becomes null immediately
      setCalendarCheckOut(null);
      setCalendarCheckIn(dateKey);
      // Update context immediately for check-in (clears any previous range)
      // Use empty string for checkOut to ensure it's properly cleared in context
      setSearchParams({
        checkIn: dateKey,
        checkOut: "",
        guests: searchParams?.guests || 1,
        pets: searchParams?.pets || 0,
      });
    }
    // If check-in is selected (but no check-out) and this date is after check-in, set as check-out
    else if (effectiveCheckIn && !effectiveCheckOut && dateKey > effectiveCheckIn) {
      // Verify the range doesn't contain any booked dates
      const checkInDate = new Date(effectiveCheckIn + 'T00:00:00');
      const checkOutDate = new Date(dateKey + 'T00:00:00');
      let current = new Date(checkInDate);
      let hasConflict = false;
      
      while (current < checkOutDate) {
        const currentKey = formatDateKey(current);
        if (bookedDates.has(currentKey)) {
          hasConflict = true;
          break;
        }
        current.setDate(current.getDate() + 1);
      }
      
      if (!hasConflict) {
        setCalendarCheckOut(dateKey);
        // Update context with both dates
        setSearchParams({
          checkIn: effectiveCheckIn,
          checkOut: dateKey,
          guests: searchParams?.guests || 1,
          pets: searchParams?.pets || 0,
        });
      }
    }
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
              const clickable = isDateClickable(date);
              // Check if this is the check-in date when only check-in is selected (no check-out)
              const isOnlyCheckIn = effectiveCheckIn && !effectiveCheckOut && dateKey === effectiveCheckIn;

              // Determine styling based on priority: booked in range > booked > selected range > check-in only > today > past > available
              let className = 'aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-colors';
              let title = 'Available';

              // If date is booked AND in selected range, highlight the box but keep booked styling
              if (booked && inRange) {
                className += ' bg-orange-100 border-2 border-orange-300 text-gray-400 line-through cursor-not-allowed';
                title = 'Booked (Selected Range)';
              } else if (booked) {
                className += ' bg-gray-200 text-gray-400 line-through cursor-not-allowed';
                title = 'Booked';
              } else if (isOnlyCheckIn) {
                // Only check-in selected - highlight border only, no fill
                className += ' bg-transparent border-2 border-[#00a19c] text-gray-700 font-semibold cursor-pointer hover:bg-[#00a19c]/5';
                title = 'Check-in selected';
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
                  title = 'Selected (Range contains unavailable dates)';
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
                className += clickable 
                  ? ' bg-[#00a19c]/10 text-[#00a19c] border-2 border-[#00a19c] font-semibold cursor-pointer hover:bg-[#00a19c]/20'
                  : ' bg-[#00a19c]/10 text-[#00a19c] border-2 border-[#00a19c] font-semibold cursor-not-allowed opacity-50';
                title = 'Today';
              } else if (past) {
                className += ' text-gray-300 cursor-not-allowed';
                title = 'Past';
              } else if (!clickable) {
                // Disabled dates (only when check-in is selected but no check-out yet)
                // When complete range is selected, all dates become clickable again
                const checkDateObj = new Date(date);
                checkDateObj.setHours(0, 0, 0, 0);
                
                if (effectiveCheckIn && !effectiveCheckOut) {
                  const checkInDate = new Date(effectiveCheckIn + 'T00:00:00');
                  checkInDate.setHours(0, 0, 0, 0);
                  
                  if (checkDateObj < checkInDate) {
                    // Dates before check-in - greyed out (only when no check-out selected)
                    className += ' bg-gray-50 text-gray-300 cursor-not-allowed opacity-40';
                    title = 'Before check-in';
                  } else {
                    className += ' text-gray-300 cursor-not-allowed opacity-50';
                    title = 'Unavailable';
                  }
                } else {
                  className += ' text-gray-300 cursor-not-allowed opacity-50';
                  title = 'Unavailable';
                }
              } else {
                className += ' text-gray-700 hover:bg-gray-50 cursor-pointer hover:font-semibold active:bg-[#00a19c]/10';
                title = 'Available';
              }

              return (
                <div
                  key={day}
                  className={className}
                  title={title}
                  onClick={() => handleDateClick(date)}
                  role="button"
                  tabIndex={clickable && !past && !booked ? 0 : -1}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && clickable && !past && !booked) {
                      e.preventDefault();
                      handleDateClick(date);
                    }
                  }}
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

