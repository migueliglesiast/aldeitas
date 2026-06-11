"use client";
import { useHotel } from "@/lib/hotel-context";
import { ReactNode } from "react";

export default function ContentContainer({ children }: { children: ReactNode }) {
  const { selectedHotelImage } = useHotel();
  const hasHotelFocus = Boolean(selectedHotelImage);

  return (
    <div className="relative mx-auto mt-[1vh] max-w-7xl px-4 py-4 md:mt-[2vh] md:py-6">
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 rounded-xl border",
          "bg-[#fcfcfb]/90 backdrop-blur-md",
          "shadow-[0_8px_32px_rgba(15,23,42,0.07)]",
          hasHotelFocus
            ? "border-[#00a19c]/15 ring-1 ring-[#00a19c]/10"
            : "border-slate-200/70 ring-1 ring-black/[0.03]",
          "transition-[border-color,box-shadow] duration-300 ease-out",
        ].join(" ")}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-xl bg-gradient-to-b from-white/60 to-transparent"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
