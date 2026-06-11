"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";

function PhotoPlaceholderIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L7 17.5" />
    </svg>
  );
}

type Props = Omit<ImageProps, "onLoad" | "onError"> & {
  onError?: () => void;
};

export default function ImageWithPlaceholder({
  src,
  alt,
  className = "",
  onError,
  ...props
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const srcKey = typeof src === "string" ? src : src.src;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [srcKey]);

  return (
    <>
      {!loaded && !failed ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200/80"
          aria-hidden
        >
          <PhotoPlaceholderIcon className="h-10 w-10 text-gray-400/90 animate-pulse md:h-12 md:w-12" />
        </div>
      ) : null}
      <Image
        {...props}
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onLoadingComplete={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
    </>
  );
}
