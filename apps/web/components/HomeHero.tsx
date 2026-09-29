"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

export function HomeHero() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-2 pt-4 text-center">
      <h1 className="font-poster text-[2rem] font-black leading-tight tracking-tight text-ink sm:text-4xl md:text-5xl">
        {t("heroTitle")}
      </h1>
      <p className="text-balance text-base leading-relaxed text-muted md:text-lg">
        {t("heroLead")}{" "}
        <span className="font-bold text-[#F97316]">{t("heroPlatforms")}</span>{" "}
        {t("heroMiddle")}{" "}
        <span className="whitespace-nowrap font-bold text-[#0092A1]">{t("heroOurCut")}</span>{" "}
        {t("heroTail")}
      </p>
    </div>
  );
}

export function HomeSignUpPrompt() {
  const { t } = useLocale();

  return (
    <div className="text-center text-sm text-muted">
      {t("newHere")}{" "}
      <Link
        className="font-semibold text-ink underline underline-offset-2 hover:text-brand"
        href="/sign-up"
      >
        {t("createAccount")}
      </Link>
    </div>
  );
}
