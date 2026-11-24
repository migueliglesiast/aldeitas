"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";

const ITEMS: Array<{ href: string; es: string; en: string; icon: string; match: (p: string) => boolean }> = [
  { href: "/admin", es: "Inicio", en: "Home", icon: "M3 10l7-6 7 6v7a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1z", match: (p) => p === "/admin" || p.startsWith("/admin/hotel") || p.startsWith("/admin/room") },
  { href: "/admin/calendar", es: "Calendario", en: "Calendar", icon: "M3 5h14v12H3zM3 9h14M7 3v4M13 3v4", match: (p) => p.startsWith("/admin/calendar") && !p.startsWith("/admin/calendars") },
  { href: "/admin/bookings", es: "Reservas directas", en: "Direct bookings", icon: "M4 4h12v12H4zM7 8h6M7 12h4", match: (p) => p.startsWith("/admin/bookings") },
  { href: "/admin/calendars", es: "Sincronización", en: "Calendar sync", icon: "M4 10a6 6 0 0110-4.5L16 7M16 10a6 6 0 01-10 4.5L4 13M16 3v4h-4M4 17v-4h4", match: (p) => p.startsWith("/admin/calendars") },
  { href: "/admin/profile", es: "Mi perfil", en: "My profile", icon: "M10 10a3 3 0 100-6 3 3 0 000 6zM4 17a6 6 0 0112 0", match: (p) => p.startsWith("/admin/profile") },
];

/** Section menu shared by every host admin page. */
export default function AdminNav() {
  const pathname = usePathname() ?? "";
  const { locale } = useLocale();
  return (
    <nav aria-label={locale === "es" ? "Secciones del panel" : "Panel sections"} className="overflow-x-auto [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:min-w-0">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="sm:flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-heading text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                  <path d={item.icon} />
                </svg>
                {locale === "es" ? item.es : item.en}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
