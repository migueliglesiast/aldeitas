"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import { useStorefront } from "@/lib/storefront-context";
import { getPortalOrigin } from "@/lib/storefront-host";

export default function StorefrontFooter() {
  const { t } = useLocale();
  const hotel = useStorefront();
  if (!hotel) return null;

  return (
    <footer className="mt-16 border-t border-line/60 bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted md:flex-row md:px-6">
        <div className="flex items-center gap-3">
          {hotel.logoImageUrl ? (
            <Image
              src={hotel.logoImageUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-contain"
            />
          ) : null}
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="font-semibold text-ink">{hotel.name}</span> · {hotel.location}
          </p>
        </div>
        <nav aria-label={hotel.name} className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/#rooms" className="hover:text-ink hover:underline">
            {t("navRooms")}
          </Link>
          <Link href="/#stay" className="hover:text-ink hover:underline">
            {t("navStay")}
          </Link>
          <Link href="/#location" className="hover:text-ink hover:underline">
            {t("navLocation")}
          </Link>
          <a href="#top" className="hover:text-ink hover:underline">
            {t("backToTop")} ↑
          </a>
        </nav>
        <a
          href={getPortalOrigin()}
          className="flex items-center gap-1.5 text-xs hover:text-ink"
        >
          {t("poweredBy")}
          <span className="font-poster text-sm font-black text-aldeitas">Aldeitas</span>
          <span>· {t("headerTagline").toLowerCase()}</span>
        </a>
      </div>
    </footer>
  );
}
