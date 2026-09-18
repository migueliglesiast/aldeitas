"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

export default function PortalFooter() {
  const { locale, t } = useLocale();
  const homeLabel = locale === "es" ? "Inicio" : "Home";
  const hotelsLabel = locale === "es" ? "Hoteles" : "Browse hotels";

  return (
    <footer className="mt-16 border-t border-line/60 bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted md:flex-row md:px-6">
        <p>
          © {new Date().getFullYear()} Aldeitas · {t("tagline")}
        </p>
        <p className="flex items-center gap-4">
          <Link href="/" className="hover:text-ink hover:underline">
            {homeLabel}
          </Link>
          <Link href="/hotel" className="hover:text-ink hover:underline">
            {hotelsLabel}
          </Link>
          <Link href="/sign-up" className="hover:text-ink hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
