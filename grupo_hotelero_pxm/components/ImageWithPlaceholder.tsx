"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type ImageProps, type StaticImageData } from "next/image";

function srcToKey(src: ImageProps["src"]): string {
  if (typeof src === "string") return src;
  if (typeof src === "object" && src !== null && "src" in src) {
    return (src as StaticImageData).src;
  }
  return "";
}

function markLoadedIfComplete(
  img: HTMLImageElement | null,
  setLoaded: (value: boolean) => void
) {
  if (img?.complete && img.naturalWidth > 0) {
    setLoaded(true);
  }
}

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
  fill,
  sizes,
  onError,
  priority,
  ...props
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const srcKey = srcToKey(src);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    markLoadedIfComplete(imgRef.current, setLoaded);
  }, [srcKey]);

  const loadingPlaceholder =
    !loaded && !failed ? (
      <div
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200/80"
        aria-hidden
      >
        <PhotoPlaceholderIcon className="h-10 w-10 text-gray-400/90 animate-pulse md:h-12 md:w-12" />
      </div>
    ) : null;

  const failedPlaceholder = failed ? (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400"
      aria-hidden
    >
      <PhotoPlaceholderIcon className="h-10 w-10 md:h-12 md:w-12" />
    </div>
  ) : null;

  const visibilityClass = loaded ? "opacity-100" : "opacity-0";

  if (typeof src === "string") {
    return (
      <>
        {loadingPlaceholder}
        {failedPlaceholder}
        {!failed ? (
          // Native img is more reliable on Hostinger with unoptimized assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              onError?.();
            }}
            className={
              fill
                ? `absolute inset-0 h-full w-full ${className} ${visibilityClass} transition-opacity duration-300`
                : `${className} ${visibilityClass} transition-opacity duration-300`
            }
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {loadingPlaceholder}
      {failedPlaceholder}
      {!failed ? (
        <Image
          {...props}
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          priority={priority}
          className={`${className} transition-opacity duration-300 ${visibilityClass}`}
          onLoad={() => setLoaded(true)}
          onLoadingComplete={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            onError?.();
          }}
        />
      ) : null}
    </>
  );
}
