"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import OwnerOnboarding from "@/components/onboarding/OwnerOnboarding";

type User = { id: string; username: string; email: string; verified?: boolean } | null;

function DashboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="4" rx="1.5" />
      <rect x="11" y="8" width="7" height="10" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  );
}

export default function AuthButton({ hideWhenSignedOut = false }: { hideWhenSignedOut?: boolean }) {
  const { t } = useLocale();
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return { user: null };
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return { user: null };
        try {
          return await r.json();
        } catch {
          return { user: null };
        }
      })
      .then((d) => {
        if (!isMounted) return;
        setUser(d?.user ?? null);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
      })
      .finally(() => setLoading(false));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (loading) return hideWhenSignedOut ? null : <div className="h-9 w-24 animate-pulse rounded bg-gray-100" />;

  if (!user) {
    if (hideWhenSignedOut) return null;
    return (
      <Link href="/sign-in" className="rounded-full bg-heading px-4 py-2 text-sm font-semibold text-white hover:bg-ink">{t("hostPortal")}</Link>
    );
  }

  async function onSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.reload();
  }

  const name = user.username || user.email || "";
  const initial = (name.trim()[0] || "?").toUpperCase();
  const itemClass = "block rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface";

  return (
    <div className="flex items-center gap-2">
      <OwnerOnboarding userId={user.id} />
      <Link
        href="/admin"
        aria-label={t("openDashboard")}
        title={t("openDashboard")}
        className="inline-flex items-center gap-1.5 rounded-full bg-heading px-3 py-2 text-sm font-semibold text-white hover:bg-ink"
      >
        <DashboardIcon />
        <span className="hidden sm:inline">{t("dashboard")}</span>
      </Link>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t("accountMenu", { name })}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-2.5 pr-1 text-ink shadow-sm transition hover:shadow-md"
        >
          <MenuIcon />
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-aldeitas text-xs font-bold text-white">
            {initial}
            <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </span>
        </button>
        {menuOpen ? (
          <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-xl">
            <div className="px-3 pb-2 pt-1">
              <p className="text-xs text-muted">{t("signedInAs")}</p>
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              {user.email && user.email !== name ? <p className="truncate text-xs text-muted">{user.email}</p> : null}
            </div>
            <div className="my-1 border-t border-line" />
            <Link role="menuitem" href="/admin" className={`${itemClass} font-semibold`} onClick={() => setMenuOpen(false)}>{t("dashboard")}</Link>
            <Link role="menuitem" href="/admin/bookings" className={itemClass} onClick={() => setMenuOpen(false)}>{t("navBookings")}</Link>
            <Link role="menuitem" href="/admin/calendars" className={itemClass} onClick={() => setMenuOpen(false)}>{t("navCalendars")}</Link>
            <div className="my-1 border-t border-line" />
            <button role="menuitem" type="button" onClick={onSignOut} className={`${itemClass} w-full text-left`}>{t("signOut")}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
