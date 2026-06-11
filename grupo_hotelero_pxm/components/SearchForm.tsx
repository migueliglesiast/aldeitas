"use client";
import { useState, useEffect, useRef } from "react";
import { useHotel } from "@/lib/hotel-context";
import { useLocale } from "@/lib/i18n/locale-context";

export default function SearchForm() {
  const { searchParams, setSearchParams, setHotelAvailability } = useHotel();
  const { t, dateLocale } = useLocale();
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
    if (!checkIn && !checkOut) {
      if (searchParams) {
        setSearchParams(null);
        setHotelAvailability(null);
      }
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
    if (!dateString) return t("addDate");
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
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

  const hasActiveSearch = Boolean(checkIn || checkOut || searchParams);

  function handleClear() {
    setCheckIn("");
    setCheckOut("");
    setGuests(1);
    setPets(0);
    setShowGuestPicker(false);
    setShowPetPicker(false);
    setSearchParams(null);
    setHotelAvailability(null);
  }

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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
        {/* Check-in Date - Airbnb style */}
        <div 
          className="flex-1 relative cursor-pointer group"
          onClick={() => {
            checkInInputRef.current?.showPicker?.() || checkInInputRef.current?.focus();
          }}
        >
          <label className="absolute left-4 top-3 text-xs font-medium text-gray-700 pointer-events-none z-10">
            {t("checkIn")}
          </label>
          <input
            ref={checkInInputRef}
            type="date"
            value={checkIn}
            onChange={(e) => handleDateChange('checkIn', e.target.value)}
            min={minDate}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
          />
          <div className="w-full h-full pt-8 pb-3 px-4 pr-12 text-sm font-medium text-gray-900 border-r border-gray-200/50 hover:bg-gray-50/50 transition-colors pointer-events-none">
            <span className={checkIn ? "text-gray-900" : "text-gray-400"}>
              {formatDateDisplay(checkIn)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-gray-200/50 self-stretch" />

        {/* Check-out Date - Airbnb style */}
        <div 
          className={`flex-1 relative group ${!checkIn ? 'opacity-50' : 'cursor-pointer'}`}
          onClick={() => {
            if (checkIn && !checkOutInputRef.current?.disabled) {
              checkOutInputRef.current?.showPicker?.() || checkOutInputRef.current?.focus();
            }
          }}
        >
          <label className="absolute left-4 top-3 text-xs font-medium text-gray-700 pointer-events-none z-10">
            {t("checkOut")}
          </label>
          <input
            ref={checkOutInputRef}
            type="date"
            value={checkOut}
            onChange={(e) => handleDateChange('checkOut', e.target.value)}
            min={getMinCheckoutDate()}
            disabled={!checkIn}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
          />
          <div className="w-full h-full pt-8 pb-3 px-4 pr-12 text-sm font-medium text-gray-900 border-r border-gray-200/50 hover:bg-gray-50/50 transition-colors pointer-events-none">
            <span className={checkOut ? "text-gray-900" : "text-gray-400"}>
              {formatDateDisplay(checkOut)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-gray-200/50 self-stretch" />

        {/* Guests Picker */}
        <div className="flex-1 relative" ref={guestPickerRef}>
          <button
            type="button"
            onClick={() => {
              setShowGuestPicker(!showGuestPicker);
              setShowPetPicker(false);
            }}
            className="w-full pt-8 pb-3 px-4 text-left text-sm font-medium text-gray-900 hover:bg-gray-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a19c]/20 border-r border-gray-200/50"
          >
            <span className="absolute left-4 top-3 text-xs font-medium text-gray-700">{t("guests")}</span>
            <span className="block mt-1">
              {guests} {guests === 1 ? t("guest") : t("guestsPlural")}
            </span>
          </button>
          
          {showGuestPicker && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200/50 p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium text-gray-900">{t("adults")}</div>
                  <div className="text-xs text-gray-500">{t("ages13Plus")}</div>
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
                className="w-full text-left text-sm font-medium text-[#00a19c] hover:underline"
              >
                {t("done")}
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-gray-200/50 self-stretch" />

        {/* Pets Picker */}
        <div className="flex-1 relative" ref={petPickerRef}>
          <button
            type="button"
            onClick={() => {
              setShowPetPicker(!showPetPicker);
              setShowGuestPicker(false);
            }}
            className="w-full pt-8 pb-3 px-4 text-left text-sm font-medium text-gray-900 hover:bg-gray-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a19c]/20"
          >
            <span className="absolute left-4 top-3 text-xs font-medium text-gray-700">{t("pets")}</span>
            <span className="block mt-1">
              {pets === 0 ? t("noPets") : `${pets} ${pets === 1 ? t("pet") : t("petsPlural")}`}
            </span>
          </button>
          
          {showPetPicker && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200/50 p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium text-gray-900">{t("pets")}</div>
                  <div className="text-xs text-gray-500">{t("serviceAnimal")}</div>
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
                className="w-full text-left text-sm font-medium text-[#00a19c] hover:underline"
              >
                {t("done")}
              </button>
            </div>
          )}
        </div>

        {/* Clear + Search */}
        <div className="flex items-center gap-2 p-2">
          {hasActiveSearch ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={isSearching}
              aria-label={t("clearSearchDates")}
              title={t("clearSearchDates")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="sr-only">{t("clearSearch")}</span>
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSearching || !checkIn || !checkOut}
            className="w-full sm:w-auto px-6 py-3 bg-[#00a19c] hover:bg-[#008a86] text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">{t("searching")}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">{t("search")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
