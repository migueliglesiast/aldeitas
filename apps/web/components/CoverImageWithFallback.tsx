"use client";

import { useState } from "react";
import ImageWithPlaceholder from "@/components/ImageWithPlaceholder";

type Props = {
  candidates: string[];
  alt: string;
  className?: string;
  imageClassName?: string;
  heightClassName?: string;
};

export default function CoverImageWithFallback({
  candidates,
  alt,
  className = "",
  imageClassName = "object-cover",
  heightClassName = "h-48",
}: Props) {
  const [index, setIndex] = useState(0);
  const src = candidates[index];

  if (!src || index >= candidates.length) {
    return (
      <div
        className={`flex w-full items-center justify-center bg-gray-100 text-gray-400 ${heightClassName} ${className}`}
      >
        No image
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden ${heightClassName} ${className}`}>
      <ImageWithPlaceholder
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className={imageClassName}
        onError={() => {
          if (index + 1 < candidates.length) {
            setIndex((current) => current + 1);
          }
        }}
      />
    </div>
  );
}
