"use client";

import Link from "next/link";
import Image from "next/image";
import AuthButton from "@/components/AuthButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/locale-context";
import { useIsStorefront } from "@/lib/storefront-context";

export default function PortalHeader() {
  const { t } = useLocale();
  const isStorefront = useIsStorefront();

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/aldeitas_logo.png"
            alt="Las Aldeitas logo"
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain md:h-10 md:w-10"
          />
          <span className="hidden flex-col sm:flex">
            <span className="font-poster text-[1.6rem] font-black leading-none tracking-tight text-aldeitas md:text-3xl">
              Aldeitas
            </span>
            <span className="mt-1 text-[0.7rem] font-medium leading-none tracking-wide text-muted md:text-xs">
              {t("headerTagline")}
            </span>
          </span>
        </Link>
        {isStorefront ? (
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
          {isStorefront ? null : <AuthButton />}
        </div>
      </div>
    </header>
  );
}
