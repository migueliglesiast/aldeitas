"use client";

import Link from "next/link";
import Image from "next/image";
import AuthButton from "@/components/AuthButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/locale-context";

export default function PortalHeader() {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/images/aldeitas_logo.png"
            alt="Las Aldeitas logo"
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain md:h-10 md:w-10"
          />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-display text-2xl font-extrabold tracking-tight text-brand">
              Aldeitas
            </span>
            <span className="text-xs font-medium text-muted">{t("tagline")}</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
