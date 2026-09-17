"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  DEFAULT_HOTEL_PALETTE,
  extractBrandPalette,
  extractLogoEdgeBackground,
  paletteToCssVars,
  type HotelBrandPalette,
} from "@/lib/hotel-branding";

type Props = {
  name: string;
  location?: string | null;
  logoImageUrl?: string | null;
  size?: "md" | "lg";
  className?: string;
  onPaletteChange?: (palette: HotelBrandPalette) => void;
};

const LOGO_DIMENSIONS = {
  md: { height: 64, maxWidth: 160 },
  lg: { height: 80, maxWidth: 200 },
} as const;

function maxWidthForHeight(height: number) {
  return Math.max(height, Math.round(height * 2.5));
}

function computeLogoContainerSize(
  naturalWidth: number,
  naturalHeight: number,
  height: number,
  maxWidth: number
) {
  const aspect = naturalWidth / naturalHeight;
  const widthAtFullHeight = Math.ceil(height * aspect);

  return {
    width: Math.min(maxWidth, Math.max(height, widthAtFullHeight)),
    height,
  };
}

function HotelLogo({
  src,
  alt,
  height,
  maxWidth,
  ringColor,
  shadowColor,
}: {
  src: string;
  alt: string;
  height: number;
  maxWidth: number;
  ringColor: string;
  shadowColor: string;
}) {
  const [containerSize, setContainerSize] = useState({ width: height, height });
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  useEffect(() => {
    let cancelled = false;

    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      setContainerSize(
        computeLogoContainerSize(img.naturalWidth, img.naturalHeight, height, maxWidth)
      );
    };
    img.onerror = () => {
      if (cancelled) return;
      setContainerSize({ width: height, height });
    };
    img.src = src;

    extractLogoEdgeBackground(src).then((color) => {
      if (!cancelled) setBackgroundColor(color);
    });

    return () => {
      cancelled = true;
    };
  }, [src, height, maxWidth]);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl shadow-sm"
      style={{
        height: containerSize.height,
        width: containerSize.width,
        backgroundColor,
        boxShadow: `0 10px 30px -18px ${shadowColor}`,
        outline: `1px solid ${ringColor}`,
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${maxWidth}px`}
        className="object-contain object-center"
      />
    </div>
  );
}

export default function HotelBrandHeader({
  name,
  location,
  logoImageUrl,
  size = "md",
  className = "",
  onPaletteChange,
}: Props) {
  const [palette, setPalette] = useState<HotelBrandPalette>(DEFAULT_HOTEL_PALETTE);
  const textRef = useRef<HTMLDivElement>(null);
  const [textBlockHeight, setTextBlockHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const updateHeight = () => {
      setTextBlockHeight(element.offsetHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [name, location, size]);

  useEffect(() => {
    if (!logoImageUrl) {
      setPalette(DEFAULT_HOTEL_PALETTE);
      onPaletteChange?.(DEFAULT_HOTEL_PALETTE);
      return;
    }

    let cancelled = false;
    extractBrandPalette(logoImageUrl).then((nextPalette) => {
      if (cancelled) return;
      setPalette(nextPalette);
      onPaletteChange?.(nextPalette);
    });

    return () => {
      cancelled = true;
    };
  }, [logoImageUrl, onPaletteChange]);

  const titleSize = size === "lg" ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl";
  const HeadingTag = size === "lg" ? "h1" : "h2";
  const fallback = LOGO_DIMENSIONS[size];
  const logoHeight = textBlockHeight ?? fallback.height;
  const logoMaxWidth = maxWidthForHeight(logoHeight);

  return (
    <div className={className} style={paletteToCssVars(palette)}>
      <div className="flex items-stretch gap-4 md:gap-5">
        {logoImageUrl ? (
          <HotelLogo
            src={logoImageUrl}
            alt={`${name} logo`}
            height={logoHeight}
            maxWidth={logoMaxWidth}
            ringColor="var(--hotel-brand-ring)"
            shadowColor="var(--hotel-brand-primary)"
          />
        ) : null}

        <div ref={textRef} className="min-w-0">
          <HeadingTag
            className={`${titleSize} font-semibold tracking-tight`}
            style={{ color: "var(--hotel-brand-primary)" }}
          >
            {name}
          </HeadingTag>
          {location ? (
            <p className="mt-1 text-sm text-gray-600 md:text-base">{location}</p>
          ) : null}
          <div
            className="mt-3 h-px w-16 rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--hotel-brand-primary), transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function useHotelBrandPalette(logoImageUrl?: string | null) {
  const [palette, setPalette] = useState<HotelBrandPalette>(DEFAULT_HOTEL_PALETTE);

  useEffect(() => {
    if (!logoImageUrl) {
      setPalette(DEFAULT_HOTEL_PALETTE);
      return;
    }

    let cancelled = false;
    extractBrandPalette(logoImageUrl).then((nextPalette) => {
      if (!cancelled) setPalette(nextPalette);
    });

    return () => {
      cancelled = true;
    };
  }, [logoImageUrl]);

  return palette;
}
