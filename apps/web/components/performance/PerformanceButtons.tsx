"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

export default function PerformanceButtons({ hotels }: { hotels: Array<{ id: string; name: string }> }) {
  const { t } = useLocale();
  return (
    <>
      {hotels.map((h) => (
        <Link
          key={h.id}
          href={`/admin/hotel/${h.id}/performance`}
          className="inline-flex items-center gap-2 rounded bg-heading px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
            <path d="M3 17h14M5 13l4-4 3 3 5-6" />
          </svg>
          {hotels.length > 1 ? t("bookingPerformanceFor", { hotel: h.name }) : t("bookingPerformance")}
        </Link>
      ))}
    </>
  );
}
