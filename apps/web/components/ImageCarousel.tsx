"use client";
import { useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  alt: string;
  sizes?: string;
  className?: string;
  onError?: () => void;
};

/**
 * Airbnb-style card image carousel: arrows appear on hover, dots indicate
 * position. Falls back to the provided onError handler for broken images.
 */
export default function ImageCarousel({ images, alt, sizes, className = "", onError }: Props) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = Math.min(index, Math.max(0, count - 1));

  if (count === 0) return null;

  return (
    <div className={`group/carousel relative h-full w-full overflow-hidden ${className}`}>
      <Image
        src={images[current]}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-300 group-hover/carousel:scale-[1.03] group-hover:scale-[1.03]"
        onError={onError}
      />
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i - 1 + count) % count);
            }}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow-pill transition-all hover:scale-105 hover:bg-white group-hover/carousel:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i + 1) % count);
            }}
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow-pill transition-all hover:scale-105 hover:bg-white group-hover/carousel:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  i === current ? "bg-white" : "bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
