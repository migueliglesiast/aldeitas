"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StorefrontHotel } from "@/lib/storefront";

const StorefrontContext = createContext<StorefrontHotel | null>(null);

export function StorefrontProvider({
  hotel,
  children,
}: {
  hotel: StorefrontHotel | null;
  children: ReactNode;
}) {
  return (
    <StorefrontContext.Provider value={hotel}>{children}</StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}

export function useIsStorefront() {
  return useStorefront() != null;
}
