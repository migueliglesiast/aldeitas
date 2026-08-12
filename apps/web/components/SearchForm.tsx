"use client";
import { useState, useEffect, useRef } from "react";
import { useHotel } from "@/lib/hotel-context";

export default function SearchForm() {
  const { searchParams, setSearchParams, setHotelAvailability } = useHotel();
  const [checkIn, setCheckIn] = useState<string>(() => searchParams?.checkIn || "");
  const [checkOut, setCheckOut] = useState<string>(() => searchParams?.checkOut || "");
  const [guests, setGuests] = useState<number>(() => searchParams?.guests || 1);
  const [pets, setPets] = useState<number>(() => searchParams?.pets || 0);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [showPetPicker, setShowPetPicker] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const petPickerRef = useRef<HTMLDivElement>(null);
  const checkInInputRef = useRef<HTMLInputElement>(null);
  const checkOutInputRef = useRef<HTMLInputElement>(null);

  // Clear search results when both dates are manually cleared
  useEffect(() => {
    if (!checkIn && !checkOut && searchParams) {
      setSearchParams(null);
      setHotelAvailability(null);
    }
  }, [checkIn, checkOut, searchParams, setSearchParams, setHotelAvailability]);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (guestPickerRef.current && !guestPickerRef.current.contains(event.target as Node)) {
        setShowGuestPicker(false);
      }
      if (petPickerRef.current && !petPickerRef.current.contains(event.target as Node)) {
        setShowPetPicker(false);
      }
    };

    if (showGuestPicker || showPetPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGuestPicker, showPetPicker]);

  const minDate = new Date().toISOString().split('T')[0];
  
  const getMinCheckoutDate = () => {
    if (!checkIn) return minDate;
    const checkInDate = new Date(checkIn);
    checkInDate.setDate(checkInDate.getDate() + 1);
    return checkInDate.toISOString().split('T')[0];
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return "Add date";
    const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDateChange = (type: 'checkIn' | 'checkOut', value: string) => {
    if (type === 'checkIn') {
      setCheckIn(value);
      // Clear check-out if it's before the new check-in
      if (checkOut && value && new Date(checkOut) <= new Date(value)) {
        setCheckOut("");
      }
    } else {
      setCheckOut(value);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkIn || !checkOut) {
      return;
    }

    setIsSearching(true);
    setSearchParams({ checkIn, checkOut, guests, pets });

    try {
      const response = await fetch("/api/search/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut }),
      });

      if (!response.ok) {
        throw new Error("Failed to check availability");
      }

      const availability = await response.json();
      setHotelAvailability(availability);
    } catch (error) {
      console.error("Error searching availability:", error);
      setHotelAvailability({});
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 bg-white rounded-3xl sm:rounded-full shadow-pill hover:shadow-card transition-shadow border border-line/80 overflow-visible sm:overflow-visible">
        {/* Check-in Date - Airbnb style */}
        <div 
          className="flex-1 relative cursor-pointer group"
          onClick={() => {
            checkInInputRef.current?.showPicker?.() || checkInInputRef.current?.focus();
          }}
        >
          <label className="absolute left-5 top-2.5 text-xs font-semibold text-ink pointer-events-none z-10">
            Check in
          </label>
          <input
            ref={checkInInputRef}
            type="date"
            aria-label="Check in"
            value={checkIn}
            onChange={(e) => handleDateChange('checkIn', e.target.value)}
            min={minDate}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
          />
          <div className="w-full h-full pt-7 pb-2.5 px-5 pr-10 text-sm font-medium text-ink rounded-l-full hover:bg-surface transition-colors pointer-events-none">
            <span className={checkIn ? "text-ink" : "text-muted"}>
              {formatDateDisplay(checkIn)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-line/70 self-stretch my-3" />

        {/* Check-out Date - Airbnb style */}
        <div 
          className={`flex-1 relative group ${!checkIn ? 'opacity-50' : 'cursor-pointer'}`}
          onClick={() => {
            if (checkIn && !checkOutInputRef.current?.disabled) {
              checkOutInputRef.current?.showPicker?.() || checkOutInputRef.current?.focus();
            }
          }}
        >
          <label className="absolute left-5 top-2.5 text-xs font-semibold text-ink pointer-events-none z-10">
            Check out
          </label>
          <input
            ref={checkOutInputRef}
            type="date"
            aria-label="Check out"
            value={checkOut}
            onChange={(e) => handleDateChange('checkOut', e.target.value)}
            min={getMinCheckoutDate()}
            disabled={!checkIn}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
          />
          <div className="w-full h-full pt-7 pb-2.5 px-5 pr-10 text-sm font-medium text-ink hover:bg-surface transition-colors pointer-events-none">
            <span className={checkOut ? "text-ink" : "text-muted"}>
              {formatDateDisplay(checkOut)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-line/70 self-stretch my-3" />

        {/* Guests Picker */}
        <div className="flex-1 relative" ref={guestPickerRef}>
          <button
            type="button"
            onClick={() => {
              setShowGuestPicker(!showGuestPicker);
              setShowPetPicker(false);
            }}
            className="w-full pt-7 pb-2.5 px-5 text-left text-sm font-medium text-ink hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <span className="absolute left-5 top-2.5 text-xs font-semibold text-ink">Guests</span>
            <span className="block mt-1">
              {guests} {guests === 1 ? 'guest' : 'guests'}
            </span>
          </button>
          
          {showGuestPicker && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-pop border border-line/60 p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-ink">Adults</div>
                  <div className="text-xs text-gray-500">Ages 13+</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGuests(Math.max(1, guests - 1))}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={guests <= 1}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-8 text-center font-medium">{guests}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(guests + 1)}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuestPicker(false)}
                className="w-full text-left text-sm font-semibold text-ink underline underline-offset-2 hover:text-brand"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-line/70 self-stretch my-3" />

        {/* Pets Picker */}
        <div className="flex-1 relative" ref={petPickerRef}>
          <button
            type="button"
            onClick={() => {
              setShowPetPicker(!showPetPicker);
              setShowGuestPicker(false);
            }}
            className="w-full pt-7 pb-2.5 px-5 text-left text-sm font-medium text-ink hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <span className="absolute left-5 top-2.5 text-xs font-semibold text-ink">Pets</span>
            <span className="block mt-1">
              {pets === 0 ? 'No pets' : `${pets} ${pets === 1 ? 'pet' : 'pets'}`}
            </span>
          </button>
          
          {showPetPicker && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-pop border border-line/60 p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-ink">Pets</div>
                  <div className="text-xs text-gray-500">Bringing a service animal?</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPets(Math.max(0, pets - 1))}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={pets <= 0}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-8 text-center font-medium">{pets}</span>
                  <button
                    type="button"
                    onClick={() => setPets(pets + 1)}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPetPicker(false)}
                className="w-full text-left text-sm font-semibold text-ink underline underline-offset-2 hover:text-brand"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Search Button */}
        <div className="p-2">
          <button
            type="submit"
            disabled={isSearching || !checkIn || !checkOut}
            className="w-full sm:w-auto px-5 py-3 bg-brand hover:bg-brand-dark text-white font-semibold rounded-full transition-all duration-200 hover:shadow-card hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">Searching...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Search</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
