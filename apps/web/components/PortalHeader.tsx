"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/locale-context";
import { useIsStorefront } from "@/lib/storefront-context";
import { isHostPath, setSiteMode, useSiteMode } from "@/lib/host-mode";

export default function PortalHeader() {
  const { t } = useLocale();
  const isStorefront = useIsStorefront();
  const pathname = usePathname();
  const host = useSiteMode(pathname) === "host";

  useEffect(() => {
    if (isHostPath(pathname)) setSiteMode("host");
  }, [pathname]);

  return (
    <header
      data-mode={host ? "host" : "guest"}
      className="sticky top-0 z-50 overflow-hidden border-b border-line/70 bg-paper/85 backdrop-blur-md"
    >
      {/* Host mode paints the bar by scaling one layer: compositor-only, no layout or repaint per frame. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 origin-right bg-heading transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] will-change-transform motion-reduce:transition-none ${
          host ? "scale-x-100" : "scale-x-0"
        }`}
      />
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href={host ? "/admin" : "/"} className="flex items-center gap-2">
          <Image
            src="/images/aldeitas_logo.png"
            alt="Las Aldeitas logo"
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain md:h-10 md:w-10"
          />
          <span className="hidden flex-col sm:flex">
            <span
              className={`font-poster text-[1.6rem] font-black leading-none tracking-tight transition-colors duration-500 md:text-3xl ${
                host ? "text-white" : "text-aldeitas"
              }`}
            >
              Aldeitas
            </span>
            <span
              className={`mt-1 text-[0.7rem] font-medium leading-none tracking-wide transition-colors duration-500 md:text-xs ${
                host ? "text-white/70" : "text-muted"
              }`}
            >
              {host ? t("hostPanelTagline") : t("headerTagline")}
            </span>
          </span>
        </Link>
        {isStorefront && !host ? (
          <nav
            aria-label="Secciones"
            className="hidden items-center gap-1 text-sm font-semibold text-ink lg:flex"
          >
            <Link href="/#rooms" className="rounded-full px-3 py-2 hover:bg-surface">
              {t("navRooms")}
            </Link>
            <Link href="/#stay" className="rounded-full px-3 py-2 hover:bg-surface">
              {t("navStay")}
            </Link>
            <Link href="/#location" className="rounded-full px-3 py-2 hover:bg-surface">
              {t("navLocation")}
            </Link>
          </nav>
        ) : null}
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher />
          <AuthButton hideWhenSignedOut={isStorefront} hostMode={host} />
        </div>
      </div>
    </header>
  );
}
