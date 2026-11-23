"use client";

import { useSyncExternalStore } from "react";

export type SiteMode = "host" | "guest";

const STORAGE_KEY = "aldeitas-mode";
const EVENT = "aldeitas-mode-change";

function read(): SiteMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "host" ? "host" : "guest";
  } catch {
    return "guest";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setSiteMode(mode: SiteMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private mode: the flip still works for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function isHostPath(pathname: string | null | undefined) {
  return Boolean(pathname && (pathname === "/admin" || pathname.startsWith("/admin/")));
}

/** Host (panel) or guest (visitor) mode. /admin pages are always host mode. */
export function useSiteMode(pathname: string | null | undefined): SiteMode {
  const stored = useSyncExternalStore(subscribe, read, () => "guest" as SiteMode);
  return isHostPath(pathname) ? "host" : stored;
}
