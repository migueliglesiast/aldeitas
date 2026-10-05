"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

export function HomeHero() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 pt-4 text-center">
      <h1 className="text-balance font-poster text-[2rem] font-black leading-[1.08] tracking-tight text-heading sm:text-4xl md:text-5xl">
        {t("heroTitle")}
      </h1>
      <div className="mx-auto max-w-xl space-y-3 pt-1">
        <p className="text-pretty text-lg leading-7 text-muted md:text-xl">
          {t("heroLead")}{" "}
          <strong className="whitespace-nowrap font-semibold text-aldeitas">{t("heroPlatforms")}</strong>.
        </p>
        <p className="text-xl font-semibold leading-8 text-heading md:text-2xl">
          <span className="underline decoration-aldeitas decoration-[5px] underline-offset-[9px] [text-decoration-skip-ink:none]">
            {t("heroOurCut")}
          </span>
        </p>
        <p className="text-pretty pt-1 text-base leading-7 text-muted">
          {t("heroTail")}
        </p>
      </div>
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
