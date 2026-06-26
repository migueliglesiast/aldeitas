"use client";

import Link from "next/link";
import HotelBrandHeader from "@/components/HotelBrandHeader";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useStorefront } from "@/lib/storefront-context";

export default function StorefrontHeader() {
  const hotel = useStorefront();
  if (!hotel) return null;

  const subtitle = hotel.storefrontTagline || hotel.location;

  return (
    <div className="mx-auto max-w-7xl px-4 mt-[4vh] md:mt-[6vh]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="inline-flex max-w-full">
          <HotelBrandHeader
            name={hotel.name}
            location={subtitle}
            logoImageUrl={hotel.logoImageUrl}
            size="lg"
          />
        </Link>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
