"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type SearchParams = {
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
} | null;

type HotelContextType = {
  selectedHotelImage: string | null;
  setSelectedHotelImage: (image: string | null) => void;
  searchParams: SearchParams;
  setSearchParams: (params: SearchParams) => void;
  hotelAvailability: Record<string, number> | null;
  setHotelAvailability: (availability: Record<string, number> | null) => void;
};

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export function HotelProvider({ children }: { children: ReactNode }) {
  const [selectedHotelImage, setSelectedHotelImage] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>(null);
  const [hotelAvailability, setHotelAvailability] = useState<Record<string, number> | null>(null);

  // Setters from useState are stable, so we can include them directly
  const value: HotelContextType = {
    selectedHotelImage,
    setSelectedHotelImage,
    searchParams,
    setSearchParams,
    hotelAvailability,
    setHotelAvailability,
  };

  return (
    <HotelContext.Provider value={value}>
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const context = useContext(HotelContext);
  if (context === undefined) {
    throw new Error("useHotel must be used within a HotelProvider");
  }
  return context;
}

