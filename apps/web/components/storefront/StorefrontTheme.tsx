"use client";

import { useEffect } from "react";
import { extractBrandPalette } from "@/lib/hotel-branding";
import { useStorefront } from "@/lib/storefront-context";

const STORAGE_PREFIX = "aldeitas-brand:";

function hexToTriplet(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(" ");
}

function mixTriplet(triplet: string, target: number, amount: number) {
  return triplet
    .split(" ")
    .map((channel) => Math.round(Number(channel) + (target - Number(channel)) * amount))
    .join(" ");
}

function applyBrand(triplet: string) {
  const root = document.documentElement.style;
  root.setProperty("--brand", triplet);
  root.setProperty("--brand-dark", mixTriplet(triplet, 0, 0.18));
  root.setProperty("--brand-light", mixTriplet(triplet, 255, 0.2));
}

/** Retints the `brand` color tokens to the storefront hotel's logo color. */
export default function StorefrontTheme() {
  const hotel = useStorefront();
  const logo = hotel?.logoImageUrl;

  useEffect(() => {
    if (!logo) return;
    const key = STORAGE_PREFIX + logo;
    const cached = window.localStorage.getItem(key);
    if (cached) applyBrand(cached);

    let cancelled = false;
    extractBrandPalette(logo).then((palette) => {
      if (cancelled) return;
      const triplet = hexToTriplet(palette.primary);
      applyBrand(triplet);
      window.localStorage.setItem(key, triplet);
    });
    return () => {
      cancelled = true;
    };
  }, [logo]);

  return null;
}
