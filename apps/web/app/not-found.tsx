"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <p className="font-poster text-6xl font-black tracking-tight text-aldeitas">404</p>
      <h1 className="mt-4 font-poster text-2xl font-black tracking-tight text-heading">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-muted">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-heading px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
      >
        {t("notFoundCta")}
      </Link>
    </div>
  );
}
