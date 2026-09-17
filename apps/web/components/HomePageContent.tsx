"use client";

import SearchForm from "@/components/SearchForm";
import HotelGrid from "@/components/HotelGrid";

type Hotel = Parameters<typeof HotelGrid>[0]["hotels"][number];

type Props = {
  hotels: Hotel[];
};

export default function HomePageContent({ hotels }: Props) {
  return (
    <div className="space-y-8">
      <div className="w-full">
        <SearchForm />
      </div>

      <HotelGrid hotels={hotels} />
    </div>
  );
}
